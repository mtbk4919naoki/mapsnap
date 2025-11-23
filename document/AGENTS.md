# AGENTS.md - 開発ガイド

このドキュメントは、Cursor ComposerのAgentsがこのプロジェクトを開発する際のガイドです。

## プロジェクト概要

WebサイトのURLを指定すると、サイトマップの取得または生成を行い、それを元にスクリーンショットを保存するCLIアプリケーションです。

## 実装済みコマンド

### ✅ 実装完了

以下のコマンドは既に実装済みです：

1. **setup.js** - ✅ 実装完了
2. **gen-sitemap.js** - ✅ 実装完了
3. **get-screenshot.js** - ✅ 実装完了
4. **zip.js** - ✅ 実装完了
5. **start.js** - ✅ 実装完了（対話式実行）

## 実装済み機能の詳細

### 1. `npm run setup`
**ファイル**: `scripts/setup.js` ✅ 実装完了

**実装内容:**
- `./dist/` ディレクトリの作成（存在しない場合）
- `./dist/screenshot/` ディレクトリの作成（存在しない場合）
- `./dist/` 内の既存ファイルを削除（クリーンアップ）

### 2. `npm run gen-sitemap "URL"`
**ファイル**: `scripts/gen-sitemap.js` ✅ 実装完了

**実装内容:**
- URL引数を解析（引用符で囲まれた形式）
- `-m, --map` オプションの処理
  - 指定された場合: リモートのsitemap.xmlをダウンロード・解析
  - sitemap index形式の場合は、全てのsitemapファイルを統合
  - 統合後のsitemap.xmlを `./dist/sitemap.xml` に保存
- オプションがない場合: `sitemap-generator` パッケージでサイトマップを生成
- **階層順に自動ソート**（0階層 → 1階層 → 2階層...）
- ドメイン名を `./dist/.config.json` に保存（zipコマンドで使用）
- TLS警告の抑制処理

**使用ライブラリ:**
- `sitemap-generator`: サイトマップ生成
- `xml2js`: XML解析
- `commander`: CLI引数解析
- `https`/`http`: HTTPリクエスト

### 3. `npm run get-screenshot [sitemap.xml]`
**ファイル**: `scripts/get-screenshot.js` ✅ 実装完了

**実装内容:**
- sitemap.xmlを解析してURLリストを取得
- 階層の深さを計算（URLパスのスラッシュ数で判定）
- `-d, --depth` オプションで階層フィルタリング（`0`で無制限）
- `-r, --repeat` オプションで各階層と親パスの組み合わせごとの上限を設定
  - 階層が異なる場合は別扱いになる（例: `hoge/foo`, `hoge/bar` と `fuga/foo`, `fuga/bar` は別グループ）
  - 親パスごとにグループ化してカウントをリセット
- `-l, --limit` オプションで全体の上限を設定
- `-c, --compress` オプションでPNG画像を圧縮（`sharp`を使用）
- `-s, --sp` オプションでSP版（スマートフォン版）のスクリーンショットも取得
  - ビューポート: 375x667px（iPhone相当）
  - ユーザーエージェント: iPhone Safari
  - SP版のファイル名には`_sp`サフィックスが付く
- `-y, --yes` オプションでエラー時の自動続行
- 各URLに対してスクリーンショットを取得
- **ファイル名**: `{pageID(4桁ゼロ埋め)}_{urlPath(/を__に置換、末尾の/は削除)}.png`（SP版は`_sp`サフィックス付き）
- 進捗表示: 「Nページ中のMページ目」
- ディレクトリの自動作成

**使用ライブラリ:**
- `puppeteer`: スクリーンショット取得
- `sharp`: PNG画像の圧縮
- `xml2js`: sitemap.xml解析
- `commander`: CLI引数解析
- `readline`: 続行確認ダイアログ

**スクリーンショット設定:**
- ビューポート: 1920x1080
- ページ読み込み: `networkidle0` まで待機
- スクロール処理: 100ms間隔、100pxずつ
- アニメーション待機: スクロール前後に各1秒
- 撮影方法: ページ全体（`fullPage: true`）

### 4. `npm run zip`
**ファイル**: `scripts/zip.js` ✅ 実装完了

**実装内容:**
- `./dist/.config.json` からドメイン名を取得
- `./dist/` 内の全ファイルをzip化（`.config.json`は除外）
- **ファイル名**: `{ドメイン名}_generated_{タイムスタンプ}.zip`
- **タイムスタンプ形式**: `YYYYMMDD_HHMMSS`
- **保存先**: `./output/` ディレクトリ（自動作成）

**使用ライブラリ:**
- `archiver`: zipファイル作成
- `fs/promises`: ファイル操作

### 5. `npm run start`
**ファイル**: `scripts/start.js` ✅ 実装完了

**実装内容:**
- 対話式で一連のコマンドを実行
- セットアップ → サイトマップ生成 → スクリーンショット取得 → zip化
- 各オプションを対話式で設定可能
- sitemap.xmlのパスは自動的に`./dist/sitemap.xml`を使用

**使用ライブラリ:**
- `readline`: 対話式入力
- `spawn`: 子プロセス実行

## ディレクトリ構成

```
playground/
├── scripts/
│   ├── setup.js          ✅ 実装完了
│   ├── gen-sitemap.js    ✅ 実装完了
│   ├── get-screenshot.js ✅ 実装完了
│   ├── zip.js            ✅ 実装完了
│   └── start.js          ✅ 実装完了
├── dist/                 # setupコマンドで作成
│   ├── sitemap.xml
│   ├── .config.json      # ドメイン情報
│   └── screenshot/
│       └── *.png
├── output/               # zipコマンドで作成
│   └── {domain}_generated_{timestamp}.zip
├── document/
│   ├── spec.md
│   └── AGENTS.md
├── sitemap.js.example    # 参考実装
├── screenshot.js.example # 参考実装
└── package.json
```

## 実装のポイント

### 階層の判定
```javascript
function getDepth(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  
  if (pathname === '/') return 0;
  return pathname.split('/').filter(segment => segment !== '').length;
}
```

### ファイル名生成
```javascript
// URLパスからファイル名を生成
let urlPath = urlObj.pathname;
// 先頭と末尾のスラッシュを削除
urlPath = urlPath.replace(/^\/+/, '').replace(/\/+$/, '');
// スラッシュを__に置換
urlPath = urlPath.replace(/\//g, '__') || 'index';
const filename = `${String(pageId).padStart(4, '0')}_${urlPath}.png`;
```

### sitemap.xmlの階層ソート
```javascript
// URLを階層順にソート
urls.sort((a, b) => {
  const depthA = getUrlDepth(a.loc[0]);
  const depthB = getUrlDepth(b.loc[0]);
  
  // 階層が同じ場合はURLでソート
  if (depthA === depthB) {
    return a.loc[0].localeCompare(b.loc[0]);
  }
  
  return depthA - depthB;
});
```

### タイムスタンプ生成
```javascript
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
const seconds = String(now.getSeconds()).padStart(2, '0');
const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
```

## 開発時の注意点

### 進捗表示の統一フォーマット
```javascript
console.log('[処理] メッセージ...');
console.log('[完了] メッセージ...');
console.log('[エラー] メッセージ...');
console.log('[警告] メッセージ...');
```

### エラーハンドリング
- 全ての非同期処理で `try-catch` を使用
- エラー時は適切なメッセージを表示して `process.exit(1)` で終了
- 2xx以外のHTTPレスポンスは続行確認（`-y`オプションで自動続行）

### URLの検証
- 引数で受け取ったURLが有効か検証する
- `new URL(url)` でパースしてエラーハンドリング

### ファイルパスの扱い
- `path.join()` を使用してパスを結合（クロスプラットフォーム対応）
- 相対パスは `process.cwd()` を基準にする
- ディレクトリが存在しない場合は自動作成（`recursive: true`）

### メモリ管理
- 大量のスクリーンショットを取得する場合、ブラウザインスタンスを適切に管理
- 必要に応じてブラウザを再起動

### 子プロセスの実行
- `spawn`を使用してNode.jsスクリプトを実行（引数が正しく渡される）
- `stdio: 'inherit'`で出力を継承

## テスト方法

### 個別コマンドのテスト
```bash
# 1. セットアップ
npm run setup

# 2. サイトマップ生成
npm run gen-sitemap "https://example.com"

# 3. スクリーンショット取得（テスト用に少ない数で）
npm run get-screenshot -- -d 1 -r 2 -l 5

# 4. zip化
npm run zip
```

### 対話式実行のテスト
```bash
npm run start
```

## 参考実装ファイル

- `sitemap.js.example`: sitemap-generatorの基本的な使い方
- `screenshot.js.example`: puppeteerでのスクリーンショット取得、スクロール処理、アニメーション待機の実装例

## 変更時のチェック手順

コードを変更した際は、以下のドキュメントを必ず確認・更新してください：

1. **spec.md** - 仕様書の更新
   - 変更した機能の仕様説明を更新
   - オプションや動作の変更があれば反映

2. **AGENTS.md** - 開発ガイドの更新
   - 実装内容の説明を更新
   - 実装のポイントや注意点があれば追加

3. **README.md** - ユーザー向けドキュメントの更新
   - 使用方法やオプションの説明を更新
   - 変更点があれば反映

### チェックリスト

変更をコミットする前に以下を確認：

- [ ] `spec.md` に変更内容が反映されているか
- [ ] `AGENTS.md` に実装内容が反映されているか
- [ ] `README.md` にユーザー向けの説明が反映されているか
- [ ] 3つのドキュメント間で矛盾がないか

## 今後の拡張可能性

- `.env`ファイルによる設定管理
- 並列処理によるスクリーンショット取得の高速化
- リトライ機能の追加
- ログファイルの出力
- プログレスバーの表示
