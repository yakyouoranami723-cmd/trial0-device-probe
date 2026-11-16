Trial Zero — ORT WebGPU Tiny Probe v0.3.0

Purpose
- Isolate the current ONNX Runtime WebGPU + Asyncify startup path from the 483 MB Qwen model.
- It runs a tiny in-memory ONNX Relu graph with two float values.
- It does not download Qwen weights, access Hugging Face model files, access Firebase, or modify the model cache.

What it downloads
- ONNX Runtime Web 1.31.0-dev.20260914-8d85527a0 JavaScript bundle.
- The matching ort-wasm-simd-threaded.asyncify.mjs and .wasm runtime assets (the WASM binary is about 27 MB).

How to use
1. Upload ort-webgpu-tiny-probe.html as a NEW FILE to the existing diagnostic branch:
   trial0-v0.2.1-diagnostics
2. Do not replace sw.js, model-test.js, model-test.html, or any existing file.
3. After GitHub Pages publishes it, open:
   https://yakyouoranami723-cmd.github.io/trial0-device-probe/ort-webgpu-tiny-probe.html
4. Keep Safari in the foreground and tap the single test button once.
5. Save the JSON and send it back.

Expected successful result
- status: success
- result.output: [0, 2]
- result.passed: true

Interpretation
- If this succeeds, the pinned ORT WebGPU/Asyncify runtime can create a tiny session on this device; the remaining issue is more likely connected to Qwen model bytes, Qwen graph/session memory, or model-specific initialization.
- If it fails during ort_import/session_create, the failure is earlier in the runtime/WebGPU/Asyncify layer and does not require the Qwen weights to reproduce.
- If Safari reloads before the report appears, tell us that the tab reloaded and at which point; do not repeatedly rerun it.

Important
- This test is diagnostic only, not a replacement for model-test.js.
- The Service Worker v06 may cache the new HTML file in trial0-phase0-shell-v06 as part of its normal same-origin document caching. It does not touch trial0-transformers-qwen25-05b-v01.
- Do not run the 483 MB model again until this tiny test is reviewed.
