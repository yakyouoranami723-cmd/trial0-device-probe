# Trial Zero Phase 0 Device Probe v0.1

これは試験体0の端末診断専用ページです。AIモデル、Firebase SDK、APIキー、ユーザーの個人データは含みません。

## GitHub Pagesで公開する場合

1. このフォルダの中身だけを、新しい専用リポジトリへアップロードします。既存のTrial Zero本体やライメイのリポジトリは使いません。
2. リポジトリの Settings → Pages を開きます。
3. Build and deployment の Source を Deploy from a branch にし、Branch を `main`、Folder を `/(root)` にして Save します。
4. 公開URLが表示されるまで待ちます。公開URLは誰でも閲覧できます。
5. iPhoneのSafariで公開URLを開き、診断を実行します。

注意：GitHub FreeではPagesのソースリポジトリは公開設定が必要です。公開するのはこの診断ファイルだけにしてください。公開前にリポジトリの中身を確認してください。GitHub Pagesで公開されたサイトはインターネット上から閲覧できます。

## iPhoneでの検査

1. Safariの通常タブで開き、診断を実行して結果をコピーします。
2. 共有メニューから「ホーム画面に追加」を選び、「Webアプリとして開く」を有効にして追加します。
3. ホーム画面のアイコンから開き、再度診断して結果をコピーします。
4. JSONまたはコピーした内容は公開リポジトリへ保存せず、個別に共有してください。

この診断はGPUの小さな計算を行うだけで、AIモデルをダウンロード・実行しません。WebGPUがOKでも、LLMが安定して動く保証にはなりません。
