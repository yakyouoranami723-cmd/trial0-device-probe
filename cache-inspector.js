'use strict';

// Read-only inspector for Transformers.js 4.3.2's browser Cache Storage.
// The model body is never read, and missing named caches are never created.
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const CACHE_KEY = 'trial0-transformers-qwen25-05b-v01';
const WEIGHT_FILENAME = 'model_q4f16.onnx';
const EXPECTED_WEIGHT_BYTES = 483003582;
const $ = (id) => document.getElementById(id);
let latestReport = null;

function setText(id, value) {
  const node = $(id);
  if (node) node.textContent = String(value);
}

function getPath(request) {
  try {
    return decodeURIComponent(new URL(request.url).pathname);
  } catch (error) {
    return '';
  }
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return '不明';
  return `${value.toLocaleString('ja-JP')} bytes`;
}

async function inspectModelCache() {
  const report = {
    app: 'Trial Zero Cache Inspector',
    version: '0.2.3-cache-diagnostics',
    inspectedAt: new Date().toISOString(),
    model: MODEL_ID,
    cacheStorageName: CACHE_KEY,
    readOnly: true,
    responseBodyRead: false,
    cacheExists: false,
    cacheEntryCount: 0,
    modelResourceCount: 0,
    modelFiles: [],
    weight: {
      filename: WEIGHT_FILENAME,
      found: false,
      responseStatus: null,
      responseOk: null,
      contentLength: null,
      expectedBytes: EXPECTED_WEIGHT_BYTES,
      sizeMatchesExpected: null,
    },
    storage: {
      usageBytes: null,
      quotaBytes: null,
      persisted: null,
    },
  };

  setText('cacheInspectionStatus', '保存済みモデルキャッシュを確認中…');
  setText('cacheInspectionDetails', 'Cache Storageの項目名と応答ヘッダーを確認しています。ファイル本文は読み出しません。');

  try {
    if (!('caches' in window)) {
      throw new Error('この環境ではCache Storage APIを利用できません。');
    }

    const cacheNames = await caches.keys();
    report.cacheExists = cacheNames.includes(CACHE_KEY);

    // Important: CacheStorage.open() creates a cache when it does not exist.
    // Only open the named cache after keys() confirmed that it is already present.
    if (report.cacheExists) {
      const cache = await caches.open(CACHE_KEY);
      const requests = await cache.keys();
      report.cacheEntryCount = requests.length;

      const modelRequests = requests.filter((request) => getPath(request).includes(MODEL_ID));
      report.modelResourceCount = modelRequests.length;
      report.modelFiles = [...new Set(modelRequests.map((request) => getPath(request).split('/').pop()).filter(Boolean))].sort();

      const weightRequest = modelRequests.find((request) => getPath(request).endsWith(`/${WEIGHT_FILENAME}`));
      if (weightRequest) {
        // Cache.match() returns Response metadata. Do not call arrayBuffer(), blob(), or text().
        const response = await cache.match(weightRequest);
        if (response) {
          const header = response.headers.get('content-length');
          const contentLength = header && /^\d+$/.test(header) ? Number(header) : null;
          report.weight = {
            filename: WEIGHT_FILENAME,
            found: true,
            responseStatus: response.status,
            responseOk: response.ok,
            contentLength,
            expectedBytes: EXPECTED_WEIGHT_BYTES,
            sizeMatchesExpected: contentLength === null ? null : contentLength === EXPECTED_WEIGHT_BYTES,
          };
        }
      }
    }

    try {
      const estimate = await navigator.storage?.estimate?.();
      report.storage.usageBytes = Number.isFinite(estimate?.usage) ? estimate.usage : null;
      report.storage.quotaBytes = Number.isFinite(estimate?.quota) ? estimate.quota : null;
    } catch (error) {}
    try {
      report.storage.persisted = navigator.storage?.persisted
        ? await navigator.storage.persisted()
        : null;
    } catch (error) {}

    latestReport = report;
    renderReport(report);
    return report;
  } catch (error) {
    report.error = {
      name: String(error?.name || 'Error'),
      message: String(error?.message || error).slice(0, 1000),
    };
    latestReport = report;
    renderReport(report);
    return report;
  }
}

function renderReport(report) {
  const weight = report.weight;
  const usage = report.storage.usageBytes === null ? '不明' : `${(report.storage.usageBytes / 1048576).toFixed(1)} MB`;
  const quota = report.storage.quotaBytes === null ? '不明' : `${(report.storage.quotaBytes / 1048576).toFixed(1)} MB`;
  const persisted = report.storage.persisted === true ? '許可済み' : report.storage.persisted === false ? '未許可' : '不明';

  let status;
  if (report.error) {
    status = `確認エラー：${report.error.name}: ${report.error.message}`;
  } else if (!report.cacheExists) {
    status = 'モデル用Cache Storageが見つかりません。新しいキャッシュは作成していません。';
  } else if (!weight.found) {
    status = `Cache Storageは存在しますが、${WEIGHT_FILENAME}は見つかりません。`;
  } else if (weight.sizeMatchesExpected === true && weight.responseOk) {
    status = `モデル本体のキャッシュ項目を確認：Content-Length ${formatBytes(weight.contentLength)}（期待値と一致）`;
  } else {
    status = `モデル本体のキャッシュ項目は存在します。HTTP ${weight.responseStatus} · Content-Length ${formatBytes(weight.contentLength)}`;
  }

  const lines = [
    `確認時刻：${report.inspectedAt}`,
    `Cache Storage名：${CACHE_KEY}`,
    `Cache Storage：${report.cacheExists ? 'あり' : 'なし'}`,
    `キャッシュ内の全項目：${report.cacheEntryCount}`,
    `対象モデルの関連項目：${report.modelResourceCount}`,
    `${WEIGHT_FILENAME}：${weight.found ? '項目あり' : '項目なし'}`,
    `応答状態：${weight.responseStatus === null ? '未取得' : `HTTP ${weight.responseStatus} (${weight.responseOk ? 'OK' : 'NG'})`}`,
    `Content-Length：${formatBytes(weight.contentLength)}`,
    `期待サイズ：${formatBytes(EXPECTED_WEIGHT_BYTES)}`,
    `サイズ一致：${weight.sizeMatchesExpected === true ? 'はい' : weight.sizeMatchesExpected === false ? 'いいえ' : '判定不能'}`,
    `サイト全体の使用量：${usage}`,
    `サイト全体の推定上限：${quota}`,
    `ストレージ永続化：${persisted}`,
    '',
    '対象モデルのキャッシュ項目：',
    ...(report.modelFiles.length ? report.modelFiles : ['（なし）']),
    '',
    '注：モデル本文は読み出していません。キャッシュの作成・削除・再取得・永続化要求は行っていません。',
  ];

  setText('cacheInspectionStatus', status);
  setText('cacheInspectionDetails', lines.join('\n'));
}

function downloadReport() {
  if (!latestReport) return;
  const blob = new Blob([JSON.stringify(latestReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trial0-cache-inspection-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('inspectModelCacheBtn').addEventListener('click', () => { void inspectModelCache(); });
$('downloadCacheReportBtn').addEventListener('click', downloadReport);
void inspectModelCache();
