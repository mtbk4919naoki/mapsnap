const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const { parseStringPromise } = require('xml2js');
const readline = require('readline');
const sharp = require('sharp');

/**
 * get-screenshotコマンド
 * sitemap.xmlを元にスクリーンショットを取得する
 */
async function getScreenshot() {
  program
    .argument('[sitemapPath]', 'sitemap.xmlのパス', './dist/sitemap.xml')
    .option('-d, --depth <number>', '階層の深さ', '0')
    .option('-r, --repeat <number>', '各階層での取得上限', '9')
    .option('-l, --limit <number>', '全体の取得上限', '100')
    .option('-c, --compress', 'PNG画像を圧縮する')
    .option('-y, --yes', 'エラー時に自動続行')
    .parse();

  const sitemapPath = program.args[0] || './dist/sitemap.xml';
  const depth = parseInt(program.opts().depth);
  const repeat = parseInt(program.opts().repeat);
  const limit = parseInt(program.opts().limit);
  const compress = program.opts().compress;
  const autoContinue = program.opts().yes;

  try {
    const fullSitemapPath = path.isAbsolute(sitemapPath)
      ? sitemapPath
      : path.join(process.cwd(), sitemapPath);

    console.log('[処理] sitemap.xmlを読み込み中...');
    const urls = await parseSitemap(fullSitemapPath);
    console.log(`[完了] ${urls.length}件のURLを検出しました`);

    // フィルタリング
    const filteredUrls = filterUrls(urls, depth, repeat, limit);
    console.log(`[処理] ${filteredUrls.length}件のURLを処理します`);

    // スクリーンショット取得
    await takeScreenshots(filteredUrls, limit, autoContinue, compress);

    console.log('[完了] すべてのスクリーンショット取得が完了しました');
  } catch (error) {
    console.error('[エラー] スクリーンショット取得中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

/**
 * sitemap.xmlを解析してURLリストを取得
 */
async function parseSitemap(sitemapPath) {
  try {
    const xmlContent = await fs.readFile(sitemapPath, 'utf-8');
    
    if (!xmlContent || xmlContent.trim() === '') {
      throw new Error('sitemap.xmlが空です。サイトマップの生成に失敗した可能性があります。');
    }
    
    const parsed = await parseStringPromise(xmlContent);

    if (!parsed || !parsed.urlset || !parsed.urlset.url) {
      throw new Error('無効なsitemap.xml形式です。サイトマップの生成に失敗した可能性があります。');
    }

    return parsed.urlset.url.map((url) => url.loc[0]);
  } catch (error) {
    throw new Error(`sitemap.xmlの読み込みに失敗しました: ${error.message}`);
  }
}

/**
 * URLをフィルタリング
 */
function filterUrls(urls, depth, repeat, limit) {
  const filtered = [];
  const groupCounts = {}; // 階層と親パスの組み合わせごとのカウント

  for (const url of urls) {
    if (filtered.length >= limit) {
      break;
    }

    const urlDepth = getDepth(url);

    // depthフィルタ（depth = 0 は無制限、それ以外は urlDepth < depth のものだけ取得）
    if (depth !== 0 && urlDepth >= depth) {
      continue;
    }

    // repeatフィルタ（各階層と親パスの組み合わせごとに上限をリセット）
    if (repeat !== 0) {
      const parentPath = getParentPath(url, urlDepth);
      const groupKey = `${urlDepth}:${parentPath}`;
      
      if (!groupCounts[groupKey]) {
        groupCounts[groupKey] = 0;
      }
      if (groupCounts[groupKey] >= repeat) {
        continue;
      }
      groupCounts[groupKey]++;
    }

    filtered.push(url);
  }

  return filtered;
}

/**
 * URLから階層の深さを取得
 */
function getDepth(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    if (pathname === '/') {
      return 0;
    }

    // 先頭のスラッシュを除いて、スラッシュの数をカウント
    return pathname.split('/').filter((segment) => segment !== '').length;
  } catch (error) {
    return 0;
  }
}

/**
 * URLから親パスを取得（階層が異なる場合は別扱いにするため）
 */
function getParentPath(url, depth) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    if (depth === 0 || pathname === '/') {
      return 'root';
    }

    // パスセグメントを取得
    const segments = pathname.split('/').filter((segment) => segment !== '');
    
    // 親パスは階層-1までのセグメントを結合
    // 例: hoge/foo/bar (階層2) → 親パス: hoge/foo
    // 例: hoge/foo (階層1) → 親パス: hoge
    if (depth === 1) {
      return segments[0] || 'root';
    }
    
    // 階層2以上の場合、親パスは depth-1 までのセグメント
    return segments.slice(0, depth - 1).join('/') || 'root';
  } catch (error) {
    return 'root';
  }
}

/**
 * スクリーンショットを取得
 */
async function takeScreenshots(urls, limit, autoContinue, compress) {
  const screenshotDir = path.join(process.cwd(), 'dist', 'screenshot');
  let pageId = 1;
  let browser = null;

  try {
    // ディレクトリが存在しない場合は作成
    await fs.mkdir(screenshotDir, { recursive: true });

    console.log('[処理] ヘッドレスブラウザを起動中...');
    browser = await puppeteer.launch();
    console.log('[完了] ブラウザ起動完了');

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const total = Math.min(urls.length, limit);

    for (let i = 0; i < urls.length && pageId <= limit; i++) {
      const url = urls[i];
      console.log(`[処理] スクリーンショット取得中: ${total}ページ中の${i + 1}ページ目 - ${url}`);

      try {
        const response = await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: 30000,
        });

        // HTTPステータスコードのチェック
        if (response && (response.status() < 200 || response.status() >= 300)) {
          const status = response.status();
          const message = `HTTP ${status} が返されました: ${url}`;

          if (!autoContinue) {
            const shouldContinue = await askContinue(message);
            if (!shouldContinue) {
              console.log('[処理] 処理を中断しました');
              break;
            }
          } else {
            console.log(`[警告] ${message} - 続行します`);
          }
        }

        // スクリーンショット取得処理
        await takeScreenshot(page, url, screenshotDir, pageId, compress);
        pageId++;
      } catch (error) {
        const message = `エラーが発生しました: ${url} - ${error.message}`;

        if (!autoContinue) {
          const shouldContinue = await askContinue(message);
          if (!shouldContinue) {
            console.log('[処理] 処理を中断しました');
            break;
          }
        } else {
          console.log(`[警告] ${message} - 続行します`);
        }
      }
    }

    if (pageId > limit) {
      console.log(`[完了] 上限値(${limit})に達したため処理を終了しました`);
    }
  } finally {
    if (browser) {
      await browser.close();
      console.log('[完了] ブラウザを終了しました');
    }
  }
}

/**
 * スクリーンショットを撮影
 */
async function takeScreenshot(page, url, screenshotDir, pageId, compress) {
  // アニメーション待機（1秒）
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // ゆっくり一番下までスクロール
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

  // アニメーション待機（1秒）
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 一番上に戻る
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });

  // ファイル名を生成
  const urlObj = new URL(url);
  let urlPath = urlObj.pathname;
  // 先頭と末尾のスラッシュを削除
  urlPath = urlPath.replace(/^\/+/, '').replace(/\/+$/, '');
  // スラッシュを__に置換
  urlPath = urlPath.replace(/\//g, '__') || 'index';
  const filename = `${String(pageId).padStart(4, '0')}_${urlPath}.png`;
  const filepath = path.join(screenshotDir, filename);

  // スクリーンショットを保存
  const screenshotBuffer = await page.screenshot({ fullPage: true });
  
  if (compress) {
    // PNG圧縮
    await sharp(screenshotBuffer)
      .png({ 
        quality: 80,
        compressionLevel: 9,
        adaptiveFiltering: true
      })
      .toFile(filepath);
    console.log(`[完了] スクリーンショット保存（圧縮済み）: ${filename}`);
  } else {
    await fs.writeFile(filepath, screenshotBuffer);
    console.log(`[完了] スクリーンショット保存: ${filename}`);
  }
}

/**
 * 続行確認ダイアログ
 */
function askContinue(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${message}\n続行しますか？ (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

// 実行
getScreenshot();

