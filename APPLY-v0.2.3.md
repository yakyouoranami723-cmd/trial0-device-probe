# v0.2.3 適用手順

対象リポジトリ：`yakyouoranami723-cmd/trial0-device-probe`  
対象ブランチ：`trial0-v0.2.1-diagnostics`

## 置き換え・追加するファイル

ルート直下の以下5ファイルを置き換え、`cache-inspector.js` を新規追加します。

- `model-test.html`（置き換え）
- `sw.js`（置き換え）
- `README-JA.md`（置き換え）
- `README-JA-MODEL-TEST.md`（置き換え）
- `cache-inspector.js`（新規追加）

**`model-test.js` は変更しません。** v0.2.2の読み込みロジックとConstantFolding実験条件をそのまま維持します。

## GitHubでの操作

1. リポジトリを開く。
2. ブランチを `trial0-v0.2.1-diagnostics` に切り替える。
3. 上記5ファイルをルートにアップロードする。
4. コミット先が同じ診断ブランチであることを確認してコミットする。
5. `main` へ直接コミット・マージしない。

## 適用後の確認

- ページ見出しがv0.2.3。
- 「4. 保存済みモデルキャッシュの確認」パネルが表示される。
- ページ起動時に自動確認される。
- `model-test.html` が `cache-inspector.js` を読み込む。
- Service Workerのシェルキャッシュ名が `trial0-phase0-shell-v06`。
- モデルキャッシュキーは従来の `trial0-transformers-qwen25-05b-v01` のまま。

## 安全上の注意

診断はCache Storageの項目名・Response状態・Content-Lengthのみを読み取ります。モデル本文は読みません。該当Cache Storageが存在しない場合は `caches.open()` を呼ばず、空のキャッシュを作りません。モデルキャッシュの削除や再取得は行いません。
