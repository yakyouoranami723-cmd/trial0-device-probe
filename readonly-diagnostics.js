'use strict';

const VERSION = '0.2.6-readonly-diagnostics';
const MODEL_CACHE_KEY = 'trial0-transformers-qwen25-05b-v01';
const MODEL_LOG_KEY = 'trial0-model-probe-log-v02';
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const TRANSFORMERS_VERSION = '4.3.2';
const $ = (id) => document.getElementById(id);
let latestReport = null;
let taskRunning = false;

function safeText(value, max = 500) {
  return String(value ?? '').slice(0, max);
}

function errorText(error, max = 500) {
  return `${error?.name || 'Error'}: ${safeText(error?.message || error, max)}`;
}

function safeUrl(raw) {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`; // Remove query strings and fragments.
  } catch {
    return safeText(raw, 500).split('?')[0].split('#')[0];
  }
}

function bytes(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function readSavedModelLog() {
  try {
    const raw = localStorage.getItem(MODEL_LOG_KEY);
    if (!raw) return { available: false, count: 0, events: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { available: true, count: 0, malformed: true, events: [] };

    // The current model-test.js records progress and diagnostics only, not prompt or answer text.
    // Keep a bounded tail because old localStorage data may have been created by earlier builds.
    return {
      available: true,
      count: parsed.length,
      events: parsed.slice(-200),
    };
  } catch (error) {
    return { available: false, count: 0, error: errorText(error, 300), events: [] };
  }
}

async function inspectCaches() {
  const result = {
    cacheStorageAvailable: 'caches' in window,
    cacheNames: [],
    caches: [],
    modelCacheName: MODEL_CACHE_KEY,
    modelCacheFound: false,
    modelCacheEntryCount: 0,
    modelRelatedFiles: [],
    nonModelEntriesInModelCache: [],
    likelyOnnxRuntimeFiles: [],
    readOnlyIntent: true,
    responseBodiesRead: false,
  };

  if (!('caches' in window)) return result;

  try {
    const names = await caches.keys();
    result.cacheNames = names;

    for (const name of names) {
      const cacheSummary = { name, entryCount: null };
      try {
        // Cache.open is called only for a name returned by caches.keys().
        // A concurrent deletion between these calls is theoretically possible; failures are caught.
        const cache = await caches.open(name);
        const requests = await cache.keys();
        cacheSummary.entryCount = requests.length;

        for (const request of requests) {
          const url = safeUrl(request.url);
          if (/onnxruntime-web@|ort-wasm-|\.asyncify\.(mjs|wasm)|\.jspi\.(mjs|wasm)/i.test(url)) {
            result.likelyOnnxRuntimeFiles.push({ cacheName: name, url });
          }
        }

        if (name === MODEL_CACHE_KEY) {
          result.modelCacheFound = true;
          result.modelCacheEntryCount = requests.length;
          for (const request of requests) {
            const url = safeUrl(request.url);
            let responseMeta = { status: null, ok: null, contentLength: null, contentType: null };
            try {
              const response = await cache.match(request);
              if (response) {
                const length = response.headers.get('content-length');
                responseMeta = {
                  status: response.status,
                  ok: response.ok,
                  contentLength: length && /^\d+$/.test(length) ? Number(length) : null,
                  contentType: response.headers.get('content-type'),
                };
              }
            } catch (error) {
              responseMeta.error = errorText(error, 250);
            }

            const entry = { url, ...responseMeta };
            if (url.includes(MODEL_ID)) result.modelRelatedFiles.push(entry);
            else result.nonModelEntriesInModelCache.push(entry);
          }
        }
      } catch (error) {
        cacheSummary.error = errorText(error, 300);
      }
      result.caches.push(cacheSummary);
    }
  } catch (error) {
    result.error = errorText(error, 400);
  }

  return result;
}

async function inspectServiceWorker() {
  const result = {
    apiAvailable: 'serviceWorker' in navigator,
    controller: null,
    registrations: [],
  };
  if (!result.apiAvailable) return result;

  const controller = navigator.serviceWorker.controller;
  result.controller = controller ? {
    scriptURL: safeUrl(controller.scriptURL),
    state: controller.state,
  } : null;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    result.registrations = registrations.map((registration) => ({
      scope: safeUrl(registration.scope),
      updateViaCache: registration.updateViaCache || null,
      active: registration.active ? { scriptURL: safeUrl(registration.active.scriptURL), state: registration.active.state } : null,
      waiting: registration.waiting ? { scriptURL: safeUrl(registration.waiting.scriptURL), state: registration.waiting.state } : null,
      installing: registration.installing ? { scriptURL: safeUrl(registration.installing.scriptURL), state: registration.installing.state } : null,
    }));
  } catch (error) {
    result.error = errorText(error, 300);
  }
  return result;
}

async function inspectStorage() {
  const result = { estimateAvailable: false, usageBytes: null, quotaBytes: null, persisted: null };
  try {
    if (navigator.storage?.estimate) {
      result.estimateAvailable = true;
      const estimate = await navigator.storage.estimate();
      result.usageBytes = bytes(estimate.usage);
      result.quotaBytes = bytes(estimate.quota);
    }
  } catch (error) {
    result.estimateError = errorText(error, 300);
  }
  try {
    if (navigator.storage?.persisted) result.persisted = await navigator.storage.persisted();
  } catch (error) {
    result.persistedError = errorText(error, 300);
  }
  return result;
}

async function inspectWebGPU() {
  const result = {
    apiAvailable: Boolean(navigator.gpu),
    adapterObtained: false,
    info: null,
    features: [],
    limits: {},
  };
  if (!navigator.gpu) return result;

  try {
    // Adapter request only. No GPUDevice is created and no compute work is submitted.
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return { ...result, error: 'requestAdapter() returned null' };
    result.adapterObtained = true;
    const info = adapter.info || {};
    result.info = {
      vendor: info.vendor || null,
      architecture: info.architecture || null,
      device: info.device || null,
      description: info.description || null,
    };
    result.features = [...adapter.features].sort();
    const wantedLimits = [
      'maxBufferSize', 'maxStorageBufferBindingSize', 'maxUniformBufferBindingSize',
      'maxComputeWorkgroupStorageSize', 'maxComputeInvocationsPerWorkgroup',
      'maxComputeWorkgroupSizeX', 'maxComputeWorkgroupsPerDimension',
      'minStorageBufferOffsetAlignment', 'minUniformBufferOffsetAlignment',
    ];
    for (const key of wantedLimits) {
      const value = adapter.limits?.[key];
      result.limits[key] = Number.isFinite(value) ? value : null;
    }
  } catch (error) {
    result.error = errorText(error, 500);
  }
  return result;
}

function environmentInfo() {
  return {
    testedAt: new Date().toISOString(),
    diagnosticVersion: VERSION,
    userAgent: navigator.userAgent || null,
    platform: navigator.platform || null,
    language: navigator.language || null,
    online: navigator.onLine,
    secureContext: window.isSecureContext,
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    iosStandalone: Boolean(navigator.standalone),
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemoryGB: Number.isFinite(navigator.deviceMemory) ? navigator.deviceMemory : null,
    crossOriginIsolated: Boolean(window.crossOriginIsolated),
    sharedArrayBufferAvailable: typeof SharedArrayBuffer !== 'undefined',
    jspi: {
      suspending: typeof WebAssembly?.Suspending !== 'undefined',
      promising: typeof WebAssembly?.promising === 'function',
    },
    performanceMemoryAvailable: Boolean(performance?.memory),
    memoryMeasurementApiAvailable: typeof performance?.measureUserAgentSpecificMemory === 'function',
    screen: {
      width: screen.width,
      height: screen.height,
      pixelRatio: window.devicePixelRatio || 1,
    },
  };
}

function renderReport() {
  if (!latestReport) return;
  $('output').textContent = JSON.stringify(latestReport, null, 2);
  $('downloadBtn').disabled = false;
  $('copyBtn').disabled = false;
}

function setTaskState(running, status) {
  taskRunning = running;
  $('runBtn').disabled = running;
  $('runtimeBtn').disabled = running || !latestReport;
  if (status) $('status').textContent = status;
}

async function runDiagnostics() {
  if (taskRunning) return;
  setTaskState(true, '読み取り専用の診断を実行中…');

  try {
    const report = {
      app: 'Trial Zero Read-only Diagnostics',
      version: VERSION,
      environment: environmentInfo(),
      storage: await inspectStorage(),
      webgpu: await inspectWebGPU(),
      cacheStorage: await inspectCaches(),
      serviceWorker: await inspectServiceWorker(),
      executedModelProbeVersions: [],
      savedModelLog: readSavedModelLog(),
      runtime: { inspected: false, note: '別ボタンでTransformers.js/ONNX Runtimeの設定を確認できます。モデルは読み込みません。' },
      safety: {
        modelLoaded: false,
        inferenceRun: false,
        modelCacheChangedByDiagnostics: false,
        cacheEntryResponseBodiesRead: false,
        serviceWorkerUpdated: false,
        storagePersistenceRequested: false,
        runtimeLibraryMayBeCachedByExistingServiceWorker: true,
      },
    };

    report.executedModelProbeVersions = report.savedModelLog.events
      .filter((event) => event?.type === 'page_open' && event?.version)
      .map((event) => ({ timestamp: event.timestamp || null, version: event.version }))
      .slice(-5);

    latestReport = report;
    renderReport();
    setTaskState(false, '診断完了。モデルの読み込み・推論は行っていません。');
  } catch (error) {
    latestReport = {
      app: 'Trial Zero Read-only Diagnostics',
      version: VERSION,
      testedAt: new Date().toISOString(),
      fatalError: errorText(error, 700),
      savedModelLog: readSavedModelLog(),
      safety: { modelLoaded: false, inferenceRun: false, modelCacheChangedByDiagnostics: false },
    };
    renderReport();
    setTaskState(false, '一部の診断に失敗しました。エラーを含む結果を保存できます。');
  }
}

function summarizeWasmPaths(paths) {
  if (typeof paths === 'string') return safeUrl(paths);
  if (!paths || typeof paths !== 'object') return null;
  return {
    mjs: typeof paths.mjs === 'string' ? safeUrl(paths.mjs) : (paths.mjs ? '[non-string value]' : null),
    wasm: typeof paths.wasm === 'string' ? safeUrl(paths.wasm) : (paths.wasm ? '[non-string value]' : null),
  };
}

async function inspectRuntime() {
  if (taskRunning || !latestReport) return;
  setTaskState(true, `Transformers.js ${TRANSFORMERS_VERSION}の設定を確認中…（モデル本体は読み込みません）`);
  try {
    // Same pinned package entry used by model-test.js. Importing it does not create an inference session.
    const module = await import(`https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}`);
    const onnx = module.env?.backends?.onnx;
    const wasm = onnx?.wasm || {};
    const binary = wasm.wasmBinary;
    const binaryBytes = binary instanceof ArrayBuffer
      ? binary.byteLength
      : (ArrayBuffer.isView(binary) ? binary.byteLength : null);

    latestReport.runtime = {
      inspected: true,
      transformersJsVersion: module.env?.version || TRANSFORMERS_VERSION,
      requestedTransformersJsVersion: TRANSFORMERS_VERSION,
      onnxruntimeWebVersion: onnx?.versions?.web || null,
      supportedDevices: typeof onnx?.getSupportedDevices === 'function' ? onnx.getSupportedDevices() : null,
      wasmPaths: summarizeWasmPaths(wasm.wasmPaths),
      wasmProxy: wasm.proxy ?? null,
      wasmNumThreads: wasm.numThreads ?? null,
      wasmBinaryAlreadyLoaded: binaryBytes !== null,
      wasmBinaryBytes: binaryBytes,
      webgpuPowerPreference: onnx?.webgpu?.powerPreference || null,
      webgpuApiAvailableAtImport: Boolean(navigator.gpu),
      jspiAvailable: typeof WebAssembly?.Suspending !== 'undefined' && typeof WebAssembly?.promising === 'function',
      note: 'Transformers.jsの環境設定を読み取っただけです。pipeline()、モデル重みの取得、InferenceSession作成、推論は呼び出していません。',
    };
    renderReport();
    setTaskState(false, 'ランタイム設定を取得しました。モデルの読み込み・推論は行っていません。');
  } catch (error) {
    latestReport.runtime = {
      inspected: true,
      error: errorText(error, 1000),
      note: 'ランタイム設定の取得に失敗しました。ほかの診断結果は保存できます。',
    };
    renderReport();
    setTaskState(false, 'ランタイム設定を取得できませんでした。ほかの診断結果は保存できます。');
  }
}

function downloadReport() {
  if (!latestReport) return;
  const blob = new Blob([JSON.stringify(latestReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `trial0-readonly-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyReport() {
  if (!latestReport) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(latestReport, null, 2));
    $('status').textContent = '診断JSONをコピーしました。';
  } catch (error) {
    $('status').textContent = `コピーできませんでした：${error?.name || 'Error'}。JSON保存を使ってください。`;
  }
}

$('runBtn').addEventListener('click', () => { void runDiagnostics(); });
$('runtimeBtn').addEventListener('click', () => { void inspectRuntime(); });
$('downloadBtn').addEventListener('click', downloadReport);
$('copyBtn').addEventListener('click', () => { void copyReport(); });

// Run the low-impact checks automatically when the page opens.
void runDiagnostics();
