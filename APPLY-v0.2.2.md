# v0.2.2 適用手順（既存診断ブランチ専用）

## 反映するファイル

同じ階層にある次の5ファイルを、リポジトリのルートへ置き換えます。

- `model-test.js`
- `model-test.html`
- `sw.js`
- `README-JA.md`
- `README-JA-MODEL-TEST.md`

## GitHubでの操作

1. リポジトリ `yakyouoranami723-cmd/trial0-device-probe` を開く。
2. ブランチを `trial0-v0.2.1-diagnostics` に切り替える。
3. Add file → Upload files を選び、上記5ファイルをルートへアップロードする。
4. 置き換え対象が5ファイルだけであることを確認する。
5. コミット先が `trial0-v0.2.1-diagnostics` であることを確認し、コミットする。
6. `main` へ直接コミットしない。マージも行わない。

## 適用後の確認

- `model-test.html` が v0.2.2 と表示される。
- 読み込み設定の選択肢に「実験：ConstantFoldingを無効化」と「標準：追加設定なし」がある。
- `sw.js` のシェルキャッシュ名が `trial0-phase0-shell-v05`。
- JSのモデルキャッシュキーは `trial0-transformers-qwen25-05b-v01` のまま。

## 注意

GitHub Pagesの公開元が `main` に設定されている場合、この診断ブランチへのコミットだけでは公開ページは更新されません。`main`へのマージやPages設定の変更は、別途確認してから行います。診断ブランチを公開せずに試す方法が使えるかは、現在のPages設定を確認する必要があります。
