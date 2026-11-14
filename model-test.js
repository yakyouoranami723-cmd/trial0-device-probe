const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
const DTYPE = 'q4f16';
const CACHE_KEY = 'trial0-transformers-qwen25-05b-v01';
const $ = (id) => document.getElementById(id);
let generator = null;
let isBusy = false;
let configConfirmed = false;
let transformersModule = null;

async function getTransformers() {
  if (!transformersModule) {
    setStatus('checkStatus', 'Transformers.js 4.3.2 を読み込み中…');
    transformersModule = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2');
    // Model files and ONNX runtime files are cached by the browser Cache API.
    transformersModule.env.useBrowserCache = true;
    transformersModule.env.useWasmCache = true;
    transformersModule.env.cacheKey = CACHE_KEY;
    transformersModule.env.allowRemoteModels = true;
    transformersModule.env.logLevel = 2;
  }
  return transformersModule;
}

function setStatus(id, message) { $(id).textContent = String(message); }
function escapeError(error) {
  const name = error?.name || 'Error';
  const message = error?.message || String(error || 'Unknown error');
  return `${name}: ${message}`;
}
function setBusy(value) {
  isBusy = value;
  $('checkBtn').disabled = value || configConfirmed;
  $('loadBtn').disabled = value || !configConfirmed || Boolean(generator);
  $('generateBtn').disabled = value || !generator;
}
function progressMessage(info) {
  if (!info || typeof info !== 'object') return;
  if (info.status === 'progress_total' && Number.isFinite(info.progress)) {
    const pct = Math.max(0, Math.min(100, info.progress));
    $('progressBar').style.width = `${pct}%`;
    setStatus('loadStatus', `モデルを取得・準備中… ${pct.toFixed(1)}%`);
    return;
  }
  if (info.status === 'initiate') {
    const file = info.file ? String(info.file).split('/').pop() : 'ファイル';
    setStatus('loadStatus', `取得開始：${file}`);
  }
  if (info.status === 'done') {
    const file = info.file ? String(info.file).split('/').pop() : 'ファイル';
    setStatus('loadStatus', `取得完了：${file}`);
  }
}
async function updateCacheStatus() {
  if (!('caches' in window)) {
    setStatus('cacheStatus', 'Cache APIが利用できません。オフライン保存を確認できません。');
    return;
  }
  try {
    const keys = await caches.keys();
    const cache = await caches.open(CACHE_KEY);
    const requests = await cache.keys();
    const estimate = await navigator.storage?.estimate?.();
    const usedMB = estimate?.usage ? (estimate.usage / 1024 / 1024).toFixed(1) : '不明';
    setStatus('cacheStatus', `モデル用キャッシュ：${requests.length}件のファイル · このサイトの保存使用量：約${usedMB}MB · キャッシュ名確認：${keys.includes(CACHE_KEY) ? 'OK' : '未確認'}`);
  } catch (error) {
    setStatus('cacheStatus', `キャッシュ確認に失敗：${escapeError(error)}`);
  }
}
function showDeviceInfo() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
  const info = [
    `安全な接続：${window.isSecureContext ? 'OK' : 'NG'}`,
    `WebGPU：${navigator.gpu ? 'APIあり' : 'APIなし'}`,
    `ホーム画面アプリ：${standalone ? 'はい' : 'いいえ'}`,
    `ネット接続：${navigator.onLine ? 'オンライン' : 'オフライン'}`,
    `端末：${navigator.userAgent.includes('iPhone') ? 'iPhone' : 'ブラウザ端末'}`
  ];
  setStatus('deviceInfo', info.join(' · '));
}

showDeviceInfo();
window.addEventListener('online', showDeviceInfo);
window.addEventListener('offline', showDeviceInfo);

$('checkBtn').addEventListener('click', async () => {
  if (isBusy) return;
  setBusy(true);
  setStatus('checkStatus', 'モデル情報を確認中…');
  try {
    if (!window.isSecureContext) throw new Error('HTTPSの安全な接続が必要です。');
    if (!navigator.gpu) throw new Error('WebGPU APIがありません。');
    if (!navigator.onLine) throw new Error('初回のモデル確認にはインターネット接続が必要です。');
    const { ModelRegistry } = await getTransformers();
    const dtypes = await ModelRegistry.get_available_dtypes(MODEL_ID);
    if (!Array.isArray(dtypes) || !dtypes.includes(DTYPE)) {
      throw new Error(`q4f16が見つかりません。確認できた形式：${Array.isArray(dtypes) ? dtypes.join(', ') : '不明'}`);
    }
    configConfirmed = true;
    setStatus('checkStatus', `確認OK：${MODEL_ID} · 利用形式：${dtypes.join(', ')} · q4f16を選択`);
    setStatus('loadStatus', 'モデル本体はまだダウンロードしていません。');
  } catch (error) {
    setStatus('checkStatus', `確認できませんでした：${escapeError(error)}`);
  } finally {
    setBusy(false);
  }
});

$('loadBtn').addEventListener('click', async () => {
  if (isBusy || !configConfirmed || generator) return;
  const ok = window.confirm('約483MBのモデル本体と付属ファイルをダウンロードします。Wi-Fi接続中で、充電に余裕がある状態ですか？');
  if (!ok) return;
  if (!navigator.onLine) {
    setStatus('loadStatus', '初回ダウンロードにはインターネット接続が必要です。');
    return;
  }
  setBusy(true);
  $('progressBar').style.width = '0%';
  setStatus('loadStatus', '読み込みを開始します。アプリを閉じずに待ってください。');
  const startedAt = performance.now();
  try {
    const { pipeline } = await getTransformers();
    generator = await pipeline('text-generation', MODEL_ID, {
      device: 'webgpu',
      dtype: DTYPE,
      progress_callback: progressMessage,
    });
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    $('progressBar').style.width = '100%';
    setStatus('loadStatus', `読み込み成功！ 所要時間 ${seconds}秒。推論はこの端末のWebGPUで実行します。`);
    $('generateBtn').disabled = false;
    await updateCacheStatus();
  } catch (error) {
    generator = null;
    setStatus('loadStatus', `読み込みに失敗：${escapeError(error)}\nアプリを閉じて再起動し、必要ならWi-Fi接続を確認してください。モデルが一部キャッシュに残る場合があります。`);
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
  $('output').textContent = '生成中…';
  setStatus('genStatus', '端末内で回答を生成中…');
  const startedAt = performance.now();
  try {
    const messages = [
      { role: 'system', content: 'あなたは日本語で簡潔に答える、ローカルAIの動作確認用アシスタントです。分からないことは断定しません。' },
      { role: 'user', content: prompt }
    ];
    const result = await generator(messages, {
      max_new_tokens: 64,
      do_sample: false,
    });
    const generated = result?.[0]?.generated_text;
    let answer = '';
    if (Array.isArray(generated)) answer = generated.at(-1)?.content || '';
    else if (typeof generated === 'string') answer = generated;
    else answer = JSON.stringify(result);
    $('output').textContent = answer || '出力は空でした。';
    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    setStatus('genStatus', `生成完了 · ${seconds}秒 · WebGPU · max_new_tokens=64`);
    await updateCacheStatus();
  } catch (error) {
    $('output').textContent = '生成に失敗しました。';
    setStatus('genStatus', `生成エラー：${escapeError(error)}`);
  } finally {
    setBusy(false);
  }
});

// Do not auto-download, auto-load, or run a model on page open.
