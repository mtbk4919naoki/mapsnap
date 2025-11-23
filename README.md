# サイトマップ・スクリーンショット取得ツール

WebサイトのURLを指定すると、サイトマップの取得または生成を行い、それを元にスクリーンショットを保存するCLIアプリケーションです。

## セットアップ

### 必要な環境

- Node.js (v20以上推奨)
- npm

### インストール

```bash
# 依存パッケージのインストール
npm install
```

### インストールされるパッケージ

- `puppeteer`: スクリーンショット取得
- `sitemap-generator`: サイトマップ生成
- `commander`: CLI引数解析
- `xml2js`: XML解析
- `archiver`: zipファイル作成

## 使用方法

### 対話式実行（推奨）

すべての処理を対話式で実行する場合：

```bash
npm run start
```

対話式で以下を設定できます：
- サイトのURL
- 既存のsitemap.xmlを使用するか
- スクリーンショット取得のオプション（階層、上限など）
- zipファイルの作成

### 個別コマンド実行

#### 1. セットアップ

```bash
npm run setup
```

出力ディレクトリ（`./dist/`、`./dist/screenshot/`）を作成し、既存ファイルをクリーンアップします。

#### 2. サイトマップの生成・取得

```bash
# サイトマップを自動生成
npm run gen-sitemap "https://example.com"

# 既存のsitemap.xmlを使用
npm run gen-sitemap "https://example.com" -m "https://example.com/sitemap.xml"
```

**オプション:**
- `-m, --map <sitemapUrl>`: 既存のsitemap.xmlのURLを指定

**出力:**
- `./dist/sitemap.xml` にサイトマップを保存
- 階層順に自動ソート（0階層 → 1階層 → 2階層...）

#### 3. スクリーンショットの取得

```bash
# 既定のsitemap.xmlを使用
npm run get-screenshot

# カスタムパスを指定
npm run get-screenshot "./dist/sitemap.xml"

# オプション付き
npm run get-screenshot -- -d 2 -r 5 -l 50 -y
```

**オプション:**
- `-d, --depth <number>`: 階層の深さ（`-1`=無制限、既定値: `-1`）
- `-r, --repeat <number>`: 各階層での取得上限（`0`=無制限、既定値: `9`）
- `-l, --limit <number>`: 全体の取得上限（既定値: `100`）
- `-y, --yes`: エラー時に自動続行

**出力:**
- `./dist/screenshot/` にスクリーンショットを保存
- ファイル名: `{pageID(4桁)}_{urlPath}.png`
  - 例: `0001_index.png`, `0002_about__contact.png`

#### 4. zipファイルの作成

```bash
npm run zip
```

**出力:**
- `./output/` ディレクトリにzipファイルを保存
- ファイル名: `{ドメイン名}_generated_{タイムスタンプ}.zip`
  - 例: `example.com_generated_20241220_143025.zip`

## ディレクトリ構成

```
playground/
├── dist/                 # 作業ディレクトリ
│   ├── sitemap.xml       # 生成されたサイトマップ
│   ├── .config.json      # ドメイン情報（内部使用）
│   └── screenshot/       # スクリーンショット保存先
│       └── *.png
├── output/               # zipファイルの出力先
│   └── {domain}_generated_{timestamp}.zip
├── scripts/               # 実行スクリプト
│   ├── setup.js
│   ├── gen-sitemap.js
│   ├── get-screenshot.js
│   ├── zip.js
│   └── start.js
└── package.json
```

## 注意事項

### スクリーンショット取得について

- 各ページの読み込みには時間がかかります（`networkidle0`まで待機）
- ページ全体をスクロールしてアニメーションを発火させるため、1ページあたり数秒かかります
- 大量のページを取得する場合は、`-l`オプションで上限を設定することを推奨します

### エラーハンドリング

- 2xx以外のHTTPレスポンスが発生した場合、続行確認ダイアログが表示されます
- `-y`オプションを指定すると、自動的に続行します
- エラーが発生した場合は、エラーメッセージを表示して終了します

### サイトマップの生成

- `sitemap-generator`を使用する場合、サイトのクローリングに時間がかかることがあります
- 既存のsitemap.xmlがある場合は、`-m`オプションで指定することを推奨します
- sitemap index形式にも対応しています（自動的に統合）

### ファイル名について

- スクリーンショットのファイル名は、URLパスのスラッシュを`__`に置換します
- 末尾のスラッシュは削除されます
- 例: `https://example.com/about/contact/` → `about__contact.png`

### 階層の判定

- 階層はURLパスのスラッシュ数で判定します
- 例: `https://example.com/page1/page2` は階層2
- ルート（`/`）は階層0

## トラブルシューティング

### スクリーンショットが取得できない

- ページの読み込みに時間がかかっている可能性があります
- `-y`オプションを使用してエラーをスキップできます
- ネットワーク接続を確認してください

### sitemap.xmlが生成されない

- URLが正しいか確認してください
- サイトがクローリングを許可しているか確認してください
- 既存のsitemap.xmlがある場合は、`-m`オプションで指定してください

### zipファイルが作成されない

- `gen-sitemap`コマンドを先に実行してください（ドメイン情報が必要です）
- `./dist/`ディレクトリにファイルが存在するか確認してください

## ライセンス

ISC

