const APP_VERSION = '0.2.2-cf-experiment';
const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const DTYPE = 'q4f16';
const CACHE_KEY = 'trial0-transformers-qwen25-05b-v01';
const LOG_STORAGE_KEY = 'trial0-model-probe-log-v02';
const MAX_EVENTS = 200;
const $ = (id) => document.getElementById(id);
const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

let generator = null;
let isBusy = false;
let configConfirmed = false;
let loadAttempted = false;
let activeOptimizerMode = 'disable-constant-folding';
let transformersModule = null;
let eventLog = [];
let currentStage = 'page_init';
let startedAt = performance.now();
let eventSequence = 0;

function setStatus(id, message) {
  const node = $(id);
  if (node) node.textContent = String(message);
}

function errorDetails(error) {
  const stack = typeof error?.stack === 'string'
    ? error.stack.split('\n').slice(0, 7).join('\n')
    : null;
  return {
    name: String(error?.name || 'Error'),
    message: String(error?.message || error || 'Unknown error').slice(0, 1200),
    stack,
  };
}

function getEnvironment() {
  const userAgent = navigator.userAgent || null;
  return {
    testedAt: new Date().toISOString(),
    sessionId: SESSION_ID,
    userAgent,
    language: navigator.language || null,
    platform: navigator.platform || null,
    online: navigator.onLine,
    secureContext: window.isSecureContext,
    webgpuAvailable: Boolean(navigator.gpu),
    standalone: window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone),
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    deviceMemoryGB: Number.isFinite(navigator.deviceMemory) ? navigator.deviceMemory : null,
    screen: {
      width: screen.width,
      height: screen.height,
      pixelRatio: window.devicePixelRatio || 1,
    },
  };
}

function persistLog() {
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(eventLog));
  } catch (error) {
    // Diagnostics must never interrupt model loading or inference.
  }
}

function renderLog() {
  const logNode = $('eventLog');
  if (!logNode) return;
  if (!eventLog.length) {
    logNode.textContent = 'まだログはありません。';
    return;
  }
  logNode.textContent = eventLog.map((entry) => {
    const time = new Date(entry.timestamp).toLocaleTimeString('ja-JP');
    const fields = Object.entries(entry)
      .filter(([key]) => !['timestamp', 'elapsedMs', 'type', 'sessionId', 'sequence'].includes(key))
      .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join(' | ');
    return `${time} +${entry.elapsedMs}ms [${entry.sessionId}#${entry.sequence}] [${entry.type}]${fields ? ` ${fields}` : ''}`;
  }).join('\n');
}

function recordEvent(type, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    elapsedMs: Math.max(0, Math.round(performance.now() - startedAt)),
    sessionId: SESSION_ID,
    sequence: ++eventSequence,
    stage: currentStage,
    type,
    ...details,
  };
  eventLog.push(entry);
  if (eventLog.length > MAX_EVENTS) eventLog = eventLog.slice(-MAX_EVENTS);
  persistLog();
  renderLog();
}

function restoreLog() {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      eventLog = parsed.filter((item) => item && typeof item === 'object').slice(-MAX_EVENTS);
    }
  } catch (error) {
    eventLog = [];
  }
  renderLog();
}

function setStage(stage) {
  currentStage = stage;
  recordEvent('stage_change', { name: stage });
}

function setBusy(value) {
  isBusy = value;
  $('checkBtn').disabled = value || configConfirmed;
  $('optimizerMode').disabled = value || loadAttempted;
  $('loadBtn').disabled = value || !configConfirmed || Boolean(generator) || loadAttempted;
  $('generateBtn').disabled = value || !generator;
  $('clearModelCacheBtn').disabled = value;
}

function progressMessage(info) {
  if (!info || typeof info !== 'object') return;
  const status = String(info.status || 'unknown');
  const file = info.file ? String(info.file).split('/').slice(-1)[0] : null;
  const progress = Number.isFinite(info.progress) ? Math.max(0, Math.min(100, info.progress)) : null;
  const loaded = Number.isFinite(info.loaded) ? info.loaded : null;
  const total = Number.isFinite(info.total) ? info.total : null;
  recordEvent('model_progress', { status, file, progress, loaded, total });

  if (status === 'initiate') {
    setStatus('loadStatus', `取得開始：${file || 'ファイル'}`);
  } else if (status === 'done') {
    setStatus('loadStatus', `取得完了：${file || 'ファイル'}`);
  } else if (progress !== null) {
    $('progressBar').style.width = `${progress}%`;
    const target = file ? `${file} · ` : '';
    setStatus('loadStatus', `取得・準備中… ${target}${progress.toFixed(1)}%`);
  } else {
    setStatus('loadStatus', `処理中：${status}${file ? ` · ${file}` : ''}`);
  }
}

async function getTransformers() {
  if (transformersModule) return transformersModule;
  setStage('transformers_runtime_import');
  setStatus('checkStatus', 'Transformers.js 4.3.2 を読み込み中…');
  recordEvent('runtime_import_start', { library: '@huggingface/transformers', version: '4.3.2' });
  try {
    transformersModule = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2');
    transformersModule.env.useBrowserCache = true;
    transformersModule.env.useWasmCache = true;
    transformersModule.env.cacheKey = CACHE_KEY;
    transformersModule.env.allowRemoteModels = true;
    transformersModule.env.logLevel = 2;
    recordEvent('runtime_import_success');
    return transformersModule;
  } catch (error) {
    recordEvent('runtime_import_error', errorDetails(error));
    throw error;
  }
}

function getSelectedOptimizerMode() {
  return $('optimizerMode')?.value === 'disable-constant-folding'
    ? 'disable-constant-folding'
    : 'standard';
}

function getOnnxRuntimeWebVersion() {
  const version = transformersModule?.env?.backends?.onnx?.versions?.web;
  return typeof version === 'string' ? version : null;
}

function updateOptimizerDescription() {
  const mode = getSelectedOptimizerMode();
  if (mode === 'disable-constant-folding') {
    setStatus(
      'optimizerDescription',
      '実験条件：ConstantFoldingを無効化する設定をONNX Runtimeへ渡します。WebGPUでの正式サポートは保証されていないため、結果を比較するための実験です。'
    );
  } else {
    setStatus(
      'optimizerDescription',
      '標準条件：追加のsession_optionsは渡しません。前回の試験と同じ標準設定です。'
    );
  }
}

function makeSessionOptions() {
  if (activeOptimizerMode === 'disable-constant-folding') {
    return {
      extra: {
        'optimization.disable_specified_optimizers': 'ConstantFolding',
      },
    };
  }
  return {};
}

async function updateCacheStatus() {
  if (!('caches' in window)) {
    setStatus('cacheStatus', 'Cache APIが利用できません。');
    recordEvent('cache_api_unavailable');
    return;
  }
  try {
    const keys = await caches.keys();
    const currentCount = keys.includes(CACHE_KEY)
      ? (await (await caches.open(CACHE_KEY)).keys()).length
      : 0;
    const estimate = await navigator.storage?.estimate?.();
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const usageMB = Number.isFinite(estimate?.usage) ? (estimate.usage / 1048576).toFixed(1) : '不明';
    const quotaMB = Number.isFinite(estimate?.quota) ? (estimate.quota / 1048576).toFixed(1) : '不明';
    setStatus('cacheStatus', `モデルキャッシュ：${currentCount}件 · サイト保存量：約${usageMB}MB / 推定上限${quotaMB}MB · 永続化：${persisted === true ? '有効' : persisted === false ? '未許可' : '不明'}`);
    recordEvent('cache_status', { modelCacheItems: currentCount, usageMB, quotaMB, persisted });
  } catch (error) {
    setStatus('cacheStatus', `キャッシュ確認に失敗：${errorDetails(error).message}`);
    recordEvent('cache_status_error', errorDetails(error));
  }
}

function showDeviceInfo() {
  const env = getEnvironment();
  const info = [
    `安全な接続：${env.secureContext ? 'OK' : 'NG'}`,
    `WebGPU：${env.webgpuAvailable ? 'APIあり' : 'APIなし'}`,
    `ホーム画面アプリ：${env.standalone ? 'はい' : 'いいえ'}`,
    `ネット接続：${env.online ? 'オンライン' : 'オフライン'}`,
    `端末：${/iPhone|iPad|iPod/.test(env.userAgent || '') ? 'Apple端末' : 'ブラウザ端末'}`,
  ];
  setStatus('deviceInfo', info.join(' · '));
}

function makeReport() {
  const sessionOptions = makeSessionOptions();
  return {
    app: 'Trial Zero 0.5B Model Probe',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    model: { id: MODEL_ID, dtype: DTYPE, cacheKey: CACHE_KEY },
    runtime: {
      library: '@huggingface/transformers',
      version: '4.3.2',
      onnxruntimeWebVersion: getOnnxRuntimeWebVersion(),
      device: 'webgpu',
    },
    testCondition: {
      optimizerMode: activeOptimizerMode,
      sessionOptions,
      supportNote: 'ConstantFolding override is experimental for WebGPU; official SessionOptions docs list extra as WebAssembly-only.',
    },
    environment: getEnvironment(),
    events: eventLog.slice(),
    privacy: '入力文と生成結果はログに含めません。',
  };
}

function downloadReport() {
  recordEvent('report_download_requested');
  const blob = new Blob([JSON.stringify(makeReport(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trial0-model-probe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('logStatus', '診断ログをJSON保存しました。');
}

async function copyReport() {
  recordEvent('report_copy_requested');
  const text = JSON.stringify(makeReport(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    setStatus('logStatus', '診断ログをコピーしました。');
  } catch (error) {
    setStatus('logStatus', `コピーできませんでした：${errorDetails(error).message} · JSON保存を使ってください。`);
    recordEvent('report_copy_error', errorDetails(error));
  }
}

async function clearModelCaches() {
  if (isBusy) return;
  if (!('caches' in window)) {
    setStatus('logStatus', 'Cache APIが利用できません。');
    return;
  }
  const ok = window.confirm('この試験で使うモデルキャッシュだけを削除します。モデルを再取得する可能性があります。診断ページ本体や他のサイトのデータは削除しません。よろしいですか？');
  if (!ok) return;
  try {
    const results = [{ key: CACHE_KEY, deleted: await caches.delete(CACHE_KEY) }];
    recordEvent('model_cache_cleared', { results });
    await updateCacheStatus();
    setStatus('logStatus', 'この試験用モデルキャッシュを削除しました。');
  } catch (error) {
    recordEvent('model_cache_clear_error', errorDetails(error));
    setStatus('logStatus', `キャッシュ削除に失敗：${errorDetails(error).message}`);
  }
}

restoreLog();
showDeviceInfo();
activeOptimizerMode = getSelectedOptimizerMode();
updateOptimizerDescription();
recordEvent('page_open', {
  version: APP_VERSION,
  optimizerMode: activeOptimizerMode,
  environment: getEnvironment(),
});
$('optimizerMode').addEventListener('change', () => {
  if (loadAttempted) return;
  activeOptimizerMode = getSelectedOptimizerMode();
  updateOptimizerDescription();
  recordEvent('optimizer_mode_selected', { optimizerMode: activeOptimizerMode });
});
window.addEventListener('online', () => { showDeviceInfo(); recordEvent('network_online'); });
window.addEventListener('offline', () => { showDeviceInfo(); recordEvent('network_offline'); });
document.addEventListener('visibilitychange', () => recordEvent('visibility_change', { visibilityState: document.visibilityState }));
window.addEventListener('pagehide', (event) => recordEvent('page_hide', { persisted: Boolean(event.persisted) }));
window.addEventListener('pageshow', (event) => recordEvent('page_show', { persisted: Boolean(event.persisted) }));
window.addEventListener('error', (event) => recordEvent('window_error', {
  message: String(event.message || 'window error').slice(0, 1200),
  filename: event.filename ? String(event.filename).split('/').slice(-1)[0] : null,
  line: Number.isFinite(event.lineno) ? event.lineno : null,
  column: Number.isFinite(event.colno) ? event.colno : null,
}));
window.addEventListener('unhandledrejection', (event) => recordEvent('unhandled_rejection', errorDetails(event.reason)));

$('checkBtn').addEventListener('click', async () => {
  if (isBusy) return;
  setBusy(true);
  setStage('model_config_check');
  setStatus('checkStatus', 'モデル情報を確認中…');
  recordEvent('config_check_start', { modelId: MODEL_ID, dtype: DTYPE });
  try {
    if (!window.isSecureContext) throw new Error('HTTPSの安全な接続が必要です。');
    if (!navigator.gpu) throw new Error('WebGPU APIがありません。');
    if (!navigator.onLine) throw new Error('初回のモデル確認にはインターネット接続が必要です。');
    const { ModelRegistry } = await getTransformers();
    setStage('model_registry_lookup');
    const dtypes = await ModelRegistry.get_available_dtypes(MODEL_ID);
    if (!Array.isArray(dtypes) || !dtypes.includes(DTYPE)) {
      throw new Error(`q4f16が見つかりません。確認できた形式：${Array.isArray(dtypes) ? dtypes.join(', ') : '不明'}`);
    }
    configConfirmed = true;
    setStatus('checkStatus', `確認OK：${MODEL_ID} · 利用形式：${dtypes.join(', ')} · q4f16を選択`);
    setStatus('loadStatus', 'モデル本体はまだダウンロードしていません。');
    recordEvent('config_check_success', { availableDtypes: dtypes });
  } catch (error) {
    const details = errorDetails(error);
    setStatus('checkStatus', `確認できませんでした：${details.name}: ${details.message}`);
    recordEvent('config_check_error', details);
  } finally {
    setBusy(false);
  }
});

$('loadBtn').addEventListener('click', async () => {
  if (isBusy || !configConfirmed || generator || loadAttempted) return;
  const ok = window.confirm('約483MBのモデル本体と付属ファイルを読み込みます。Wi-Fi接続中で、充電に余裕がある状態ですか？');
  if (!ok) return;
  if (!navigator.onLine) {
    setStatus('loadStatus', '初回のモデル取得にはインターネット接続が必要です。');
    recordEvent('load_blocked_offline');
    return;
  }

  activeOptimizerMode = getSelectedOptimizerMode();
  loadAttempted = true;
  const sessionOptions = makeSessionOptions();

  setBusy(true);
  $('progressBar').style.width = '0%';
  setStatus('loadStatus', '読み込みを開始します。アプリを閉じずに待ってください。');
  const loadStartedAt = performance.now();
  recordEvent('model_load_requested', {
    cacheKey: CACHE_KEY,
    device: 'webgpu',
    dtype: DTYPE,
    optimizerMode: activeOptimizerMode,
    sessionOptions,
  });
  try {
    const { pipeline } = await getTransformers();
    setStage('model_download_and_session_initialization');
    const options = {
      device: 'webgpu',
      dtype: DTYPE,
      progress_callback: progressMessage,
      session_options: sessionOptions,
    };
    recordEvent('pipeline_create_start', {
      device: options.device,
      dtype: options.dtype,
      optimizerMode: activeOptimizerMode,
      sessionOptions: options.session_options,
      onnxruntimeWebVersion: getOnnxRuntimeWebVersion(),
    });
    generator = await pipeline('text-generation', MODEL_ID, options);
    const seconds = ((performance.now() - loadStartedAt) / 1000).toFixed(1);
    $('progressBar').style.width = '100%';
    setStatus('loadStatus', `読み込み成功！ 所要時間 ${seconds}秒。推論はこの端末のWebGPUで実行します。`);
    $('generateBtn').disabled = false;
    recordEvent('pipeline_create_success', {
      elapsedSeconds: Number(seconds),
      optimizerMode: activeOptimizerMode,
      onnxruntimeWebVersion: getOnnxRuntimeWebVersion(),
    });
    await updateCacheStatus();
  } catch (error) {
    generator = null;
    const details = errorDetails(error);
    setStatus(
      'loadStatus',
      `読み込みに失敗：${details.name}: ${details.message}\nこのページ内では再試行しません。診断ログを保存してください。別条件を試す場合はページを再読み込みして条件を切り替えます。`
    );
    recordEvent('pipeline_create_error', {
      ...details,
      optimizerMode: activeOptimizerMode,
      onnxruntimeWebVersion: getOnnxRuntimeWebVersion(),
      elapsedSeconds: Number(((performance.now() - loadStartedAt) / 1000).toFixed(1)),
    });
  } finally {
    setBusy(false);
  }
});

$('generateBtn').addEventListener('click', async () => {
  if (isBusy || !generator) return;
  const prompt = $('prompt').value.trim();
  if (!prompt) {
    setStatus('genStatus', '入力文を入力してください。');
    return;
  }
  if (prompt.length > 500) {
    setStatus('genStatus', 'この初期試験では入力文を500文字以内にしてください。');
    return;
  }
  setBusy(true);
  setStage('text_generation');
  $('output').textContent = '生成中…';
  setStatus('genStatus', '端末内で回答を生成中…');
  const generationStartedAt = performance.now();
  recordEvent('generation_start', { promptLength: prompt.length, maxNewTokens: 64 });
  try {
    const messages = [
      { role: 'system', content: 'あなたは日本語で簡潔に答える、ローカルAIの動作確認用アシスタントです。分からないことは断定しません。' },
      { role: 'user', content: prompt },
    ];
    const result = await generator(messages, { max_new_tokens: 64, do_sample: false });
    const generated = result?.[0]?.generated_text;
    let answer = '';
    if (Array.isArray(generated)) answer = generated.at(-1)?.content || '';
    else if (typeof generated === 'string') answer = generated;
    else answer = JSON.stringify(result);
    $('output').textContent = answer || '出力は空でした。';
    const seconds = ((performance.now() - generationStartedAt) / 1000).toFixed(1);
    setStatus('genStatus', `生成完了 · ${seconds}秒 · WebGPU · max_new_tokens=64`);
    recordEvent('generation_success', { elapsedSeconds: Number(seconds), outputLength: answer.length });
    await updateCacheStatus();
  } catch (error) {
    $('output').textContent = '生成に失敗しました。';
    const details = errorDetails(error);
    setStatus('genStatus', `生成エラー：${details.name}: ${details.message}`);
    recordEvent('generation_error', details);
  } finally {
    setBusy(false);
  }
});

$('copyLogBtn').addEventListener('click', copyReport);
$('downloadLogBtn').addEventListener('click', downloadReport);
$('clearModelCacheBtn').addEventListener('click', clearModelCaches);
$('clearLogBtn').addEventListener('click', () => {
  if (!window.confirm('この端末に保存されたTrial Zeroモデル試験ログを削除しますか？')) return;
  eventLog = [];
  try { localStorage.removeItem(LOG_STORAGE_KEY); } catch (error) {}
  renderLog();
  setStatus('logStatus', 'この試験ページのログを削除しました。');
});

// Do not auto-download, auto-load, or run a model on page open.
