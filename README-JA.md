# Trial Zero — Device / Local Model Probe

試験体0の開発用に、端末の機能確認とローカルAIモデルの実機試験を行う小さなPWAです。

## 含まれる機能

- `index.html`: Phase 0端末診断（WebGPU、IndexedDB、OPFS、Web Crypto、Service Worker等）
- `model-test.html` / `model-test.js`: Qwen2.5-0.5B-InstructのONNX / q4f16 / WebGPU試験
- `sw.js`: アプリシェルとTransformers.jsライブラリのキャッシュ
- `manifest.webmanifest` / `icon.svg`: PWA設定とアイコン

このリポジトリは診断・モデル試験用です。Trial Zero本体、ライメイの実データ、Firebase設定、APIキー、個人情報は置かないでください。

## モデル試験 v0.2.2

`README-JA-MODEL-TEST.md` に、試験順序・注意事項・ログの共有方法をまとめています。

v0.2.2では、標準設定とConstantFolding無効化の実験設定を選択でき、設定名とONNX Runtimeのバージョンを診断ログへ記録します。1ページにつき読み込みは1回に制限し、Service Workerのシェルキャッシュをv05へ更新します。v0.2.1から引き続き、モデル取得・読み込みの段階、ファイル単位のイベント、ページの表示状態、エラーを端末内ログへ記録します。入力文と生成結果はログに含めません。

ConstantFolding無効化は実験条件として追加しました。公式API資料は `session_options.extra` をWebAssembly向けとしていますが、Issue #33793では別モデルでWebGPU上の効果が報告されています。Qwenのグラフに同じ原因があるか、またこの設定が実際に反映されるかは未確認です。モデルキャッシュ識別子は既存値を維持し、診断コードの更新だけで483MBモデルの再取得を強制しません。

## GitHub Pages

このリポジトリの `main` ブランチのルートをGitHub Pagesの公開元に設定した場合、ページはインターネット上から閲覧できるようになります。公開前にファイルを確認し、診断JSONや個人情報をリポジトリへアップロードしないでください。
