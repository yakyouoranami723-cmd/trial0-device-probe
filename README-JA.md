# Trial Zero — Device / Local Model Probe

試験体0の開発用に、端末の機能確認とローカルAIモデルの実機試験を行う小さなPWAです。

## 含まれる機能

- `index.html`: Phase 0端末診断（WebGPU、IndexedDB、OPFS、Web Crypto、Service Worker等）
- `model-test.html` / `model-test.js`: Qwen2.5-0.5B-InstructのONNX / q4f16 / WebGPU試験
- `cache-inspector.js`: Transformers.jsモデルCache Storageの読み取り専用診断
- `sw.js`: アプリシェルとTransformers.jsライブラリのキャッシュ
- `manifest.webmanifest` / `icon.svg`: PWA設定とアイコン

このリポジトリは診断・モデル試験用です。Trial Zero本体、ライメイの実データ、Firebase設定、APIキー、個人情報は置かないでください。

## モデル試験 v0.2.3

`README-JA-MODEL-TEST.md` に、試験順序・注意事項・ログの共有方法をまとめています。

v0.2.3では、Transformers.jsが利用するモデルCache Storageをページ起動時とボタン操作で読み取り専用検査します。`model_q4f16.onnx` の項目有無、応答状態、Content-Lengthを確認し、ファイル本文は読み出しません。キャッシュの新規作成・削除・再取得・永続化要求は行いません。モデルキャッシュ識別子は `trial0-transformers-qwen25-05b-v01` のままです。Service Workerのシェルキャッシュだけをv06へ更新します。

## GitHub Pages

診断ブランチを公開する場合、ページはインターネット上から閲覧できるようになります。公開前にファイルを確認し、診断JSONや個人情報をリポジトリへアップロードしないでください。
