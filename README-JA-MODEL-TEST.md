# Trial Zero 0.5B Model Probe v0.2.3

## 目的

iPhoneのSafari / ホーム画面PWA上で小型言語モデルを取得・読み込み、WebGPUで日本語回答を生成できるかを段階別に確認する試験です。これはTrial Zero本体ではありません。

## 試験モデル

- `onnx-community/Qwen2.5-0.5B-Instruct`
- ONNX量子化: `q4f16`
- ONNX重みファイル: 約483MB（Tokenizer・設定・ランタイム等は別）
- `@huggingface/transformers` 4.3.2 / WebGPU
- Firebase・外部推論APIは使用しません。初回はjsDelivrからライブラリ、Hugging Faceからモデル関連ファイルを取得します。

## v0.2.3の変更

- Transformers.jsのモデルCache Storageを読み取り専用で確認する `cache-inspector.js` を追加。
- `model_q4f16.onnx` のキャッシュ項目有無、HTTP応答状態、Content-Lengthを表示。
- 約483MBのモデル本文は読み出さず、Cache Storageの新規作成・削除・再取得・永続化要求を行わない。
- 診断JSONを明示的なボタン操作で保存できる。
- モデルキャッシュ識別子は既存の `trial0-transformers-qwen25-05b-v01` を維持。
- Service Workerのシェルキャッシュをv06へ更新し、診断スクリプトもシェル対象に追加。

## キャッシュ診断の根拠と読み方

Transformers.js 4.3.2のソースでは、ブラウザキャッシュ取得時に `caches.open(env.cacheKey)` を使い、モデルファイルをHugging FaceのリモートURLで検索・保存します。このページの `CACHE_KEY` は `trial0-transformers-qwen25-05b-v01` です。

- Cache Storage名が見つからない場合は `caches.open()` を呼びません。`open()` は存在しない名前で呼ぶと空のキャッシュを作成するためです。
- `model_q4f16.onnx` のURLがCache Storageに存在し、`cache.match()` からResponseを取得できた場合は保存項目ありと表示します。
- Content-Lengthが483,003,582 bytesなら、保存時のサイズメタデータが期待値と一致しています。ただし本文の読み出しやハッシュ照合はしないため、ファイル内容の完全性までは保証しません。
- キャッシュ項目が存在しても、ONNX Runtimeのセッション初期化やWebGPU推論の成功を意味しません。
- ストレージ永続化が「未許可」でも、直ちにキャッシュが消える意味ではありません。ブラウザの保持方針や容量などにより削除される可能性が残ります。

## iPhoneでの確認順序

1. Wi-Fi接続・十分な充電を確認。
2. 公開ページを再読み込みし、v0.2.3の表示を確認。
3. ページ起動後に自動で行われるキャッシュ確認の結果を読む。
4. 必要なら「保存済みキャッシュを確認」を押して再確認。
5. 結果を共有する場合は「キャッシュ診断をJSON保存」を押す。
6. キャッシュ診断が完了するまで、モデル読み込みボタンを押さない。
7. キャッシュの有無が確認できたら、次の段階としてモデル初期化の試験方法を決める。

## 判定基準

- キャッシュなし: 今回のページ/オリジンから指定Cache Storageまたは対象項目が見えない。直ちに再ダウンロードを開始せず、ストレージの分離・消失の可能性も考慮する。
- 対象項目あり・HTTP 200: Cache API上に対象URLのResponseが存在する。
- Content-Length一致: キャッシュ保存時のサイズメタデータが期待値と一致する。本文のハッシュ検証ではない。
- モデル初期化成功: 別途 `pipeline_create_success` が必要。
- 日本語生成成功: 別途 `generation_success` が必要。

## 注意

キャッシュ診断はモデル本文を読み出しません。入力文や生成結果も記録しません。iPhoneが高温になる、アプリが終了する、応答しなくなる場合は試験を中止してください。
