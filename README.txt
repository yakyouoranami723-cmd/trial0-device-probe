Trial Zero — Qwen Load Observer v0.3.1

What this is
- A single-file, read-only-first diagnostic page for Qwen2.5-0.5B-Instruct.
- Phase 1 checks ModelRegistry file names/sizes/cache state and the small config.json only.
- Phase 2 is a separately confirmed, one-attempt Qwen pipeline load using WebGPU q4f16 with ConstantFolding disabled.
- It records WASM memory objects, WebGPU buffer allocations (where the browser exposes the relevant interfaces), model progress, errors, and visibility/page lifecycle events.
- It does not run text generation, store prompts, or save model output.

Important
- Phase 1 does not download the 483 MB model weights. It imports Transformers.js and fetches file metadata plus config.json.
- Phase 2 may download about 483 MB if the model is not already cached. Do not run it merely to check the page.
- The page stores its attempt flag and bounded diagnostic log in localStorage. The same page version will not offer a second load attempt after one attempt has started.
- This browser-side instrumentation cannot measure all Safari/WebKit process memory or every GPU allocation. It is a diagnostic aid, not a complete memory profiler.

Use
1. Upload qwen-load-observer-v0.3.1.html as a NEW file at the repository root on branch trial0-v0.2.1-diagnostics. Do not overwrite model-test.html, model-test.js, sw.js, or any main-branch file.
2. Open the GitHub Pages URL ending in /qwen-load-observer-v0.3.1.html in Safari.
3. Press only “モデル情報だけ確認（モデル本体は取得しない）” first and share that JSON.
4. Wait for the review of that preflight result before running the one-time Qwen load button.

Local validation
- JavaScript syntax checked with Node.js 22.16.0.
- No iPhone execution has been performed yet.
