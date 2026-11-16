# Trial Zero Read-only Diagnostics v0.2.6

## 目的

Trial Zeroの0.5Bモデル試験で、モデルを再読み込みする前に端末環境・Cache Storage・Service Worker・過去のモデル診断ログ・Transformers.js/ONNX Runtimeの設定を読み取り専用で確認するページです。

## 安全仕様

- モデル本体をダウンロードしません。
- `pipeline()` を呼び出さず、ONNX InferenceSessionも作成しません。
- テキスト生成・推論を実行しません。
- Cache Storageのキャッシュ名と項目を列挙し、Responseのヘッダーだけ確認します。Response本文は読みません。
- 既存のモデルキャッシュを削除・変更しません。
- Service Workerの登録状態を読むだけで、登録・更新・skipWaiting等を行いません。
- `navigator.storage.persist()` は呼びません。`persisted()` と `estimate()` の読み取りのみです。
- WebGPUはAdapterの取得のみです。GPUDeviceを作成せず、計算負荷を与えません。
- モデル試験のlocalStorageログは読み取りのみです。現在のmodel-test.jsは入力文と生成回答そのものを記録しませんが、共有前にJSONを開いて確認してください。
- ランタイム確認ボタンはTransformers.js 4.3.2のJavaScriptモジュールをimportします。モデル本体の取得やInferenceSession生成は行いません。既存Service Workerのルールにより、未キャッシュのライブラリJSがランタイム用キャッシュに追加される場合があります。モデル本体キャッシュには触れません。

## GitHub Pagesへの配置

診断ブランチ `trial0-v0.2.1-diagnostics` のリポジトリ直下へ、次の2ファイルを追加します。READMEは手元で読むための説明書なので、リポジトリへ追加する必要はありません。

- `readonly-diagnostics.html`
- `readonly-diagnostics.js`

既存の `index.html`、`model-test.html`、`model-test.js`、`sw.js` は変更しません。初回はオンラインでページを開いてください。

配置後のURL：

`https://yakyouoranami723-cmd.github.io/trial0-device-probe/readonly-diagnostics.html`

## 実行手順

1. モデル試験ページでモデル読み込みを再実行しないでください。
2. 上記URLをiPhoneで開きます。
3. 自動診断が完了したら「Transformers.js / ONNX Runtimeの設定も確認」を押します。
4. 診断が完了したら「診断結果をJSON保存」を押し、保存されたJSONを共有してください。

## 特に見る項目

- `cacheStorage.caches[]`：Cache Storage全体の名称と件数
- `cacheStorage.nonModelEntriesInModelCache[]`：モデルキャッシュ内の非モデル項目
- `cacheStorage.likelyOnnxRuntimeFiles[]`：各キャッシュ内で見つかったONNX RuntimeのWASM/JSファイル候補
- `runtime.wasmPaths`：Transformers.jsが設定している実際のWASMファイル名
- `runtime.onnxruntimeWebVersion`：実際に選択されているONNX Runtimeバージョン
- `environment.jspi`：JSPI APIの有無
- `savedModelLog.events`：既存のモデル試験の過去ログ
- `executedModelProbeVersions`：過去のモデル試験ログに記録された実行JSバージョン

## 注意

Web APIからiPhoneの正確な機種名、物理RAM、iOSのビルド番号、WebContentプロセスの実メモリ量や終了理由は取得できません。これらは端末の「設定」画面やiOSの解析ログで別途確認が必要です。CacheStorage名を列挙してから既存キャッシュを開く手順の間に別タブ等がキャッシュを削除する競合があれば、そのエラーを結果に記録します。
