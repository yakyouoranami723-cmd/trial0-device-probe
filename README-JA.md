[README-JA.md](https://github.com/user-attachments/files/34864641/README-JA.md)
# Trial Zero — Device / Local Model Probe

試験体0の開発用に、端末の機能確認とローカルAIモデルの実機試験を行う小さなPWAです。

## 含まれる機能

- `index.html`: Phase 0端末診断（WebGPU、IndexedDB、OPFS、Web Crypto、Service Worker等）
- `model-test.html` / `model-test.js`: Qwen2.5-0.5B-InstructのONNX / q4f16 / WebGPU試験
- `sw.js`: アプリシェルとTransformers.jsライブラリのキャッシュ
- `manifest.webmanifest` / `icon.svg`: PWA設定とアイコン

このリポジトリは診断・モデル試験用です。Trial Zero本体、ライメイの実データ、Firebase設定、APIキー、個人情報は置かないでください。

## モデル試験 v0.2.1

`README-JA-MODEL-TEST.md` に、試験順序・注意事項・ログの共有方法をまとめています。

v0.2.1では、モデル取得・読み込みの段階、ファイル単位のイベント、ページの表示状態、エラーを端末内ログへ記録します。入力文と生成結果はログに含めません。ConstantFolding無効化の仮説は保留しています。ONNX Runtimeの現行JavaScript API資料では session_options.extra はWebAssemblyバックエンド向けとされ、今回のWebGPU試験で有効と確認できていないためです。モデルキャッシュ識別子は既存値を維持し、診断コードの更新だけで483MBモデルの再取得を強制しません。

## GitHub Pages

このリポジトリの `main` ブランチのルートをGitHub Pagesの公開元に設定した場合、ページはインターネット上から閲覧できるようになります。公開前にファイルを確認し、診断JSONや個人情報をリポジトリへアップロードしないでください。
