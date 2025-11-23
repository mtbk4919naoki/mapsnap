const SitemapGenerator = require('sitemap-generator');
const fs = require('fs').promises;
const path = require('path');
const { program } = require('commander');
const https = require('https');
const http = require('http');
const { parseStringPromise } = require('xml2js');

/**
 * gen-sitemapコマンド
 * サイトマップを生成または取得する
 */
async function genSitemap() {
  program
    .argument('<url>', 'サイトのURL')
    .option('-m, --map <sitemapUrl>', '既存のsitemap.xmlのURL')
    .parse();

  const url = program.args[0];
  const sitemapUrl = program.opts().map;
  const outputPath = path.join(process.cwd(), 'dist', 'sitemap.xml');

  try {
    // URLの検証
    new URL(url);
    
    // ドメイン名を保存（zipコマンドで使用）
    await saveDomain(url);

    if (sitemapUrl) {
      console.log('[処理] 既存のsitemap.xmlを取得・統合中...');
      await fetchAndMergeSitemap(sitemapUrl, outputPath);
    } else {
      // sitemap-generatorのTLS警告を抑制
      // 警告メッセージを一時的に無効化（実際のTLS検証は変更しない）
      const originalEmitWarning = process.emitWarning;
      process.emitWarning = function(warning, ...args) {
        if (typeof warning === 'string' && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) {
          return; // この警告を抑制
        }
        return originalEmitWarning.apply(process, [warning, ...args]);
      };

      console.log('[処理] サイトマップを生成中...');
      try {
        await generateSitemap(url, outputPath);
      } finally {
        // 警告処理を元に戻す
        process.emitWarning = originalEmitWarning;
      }
    }

    // 階層順にソート
    console.log('[処理] サイトマップを階層順にソート中...');
    await sortSitemapByDepth(outputPath);

    console.log('[完了] サイトマップの生成が完了しました:', outputPath);
  } catch (error) {
    console.error('[エラー] サイトマップ生成中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

/**
 * sitemap-generatorを使用してサイトマップを生成
 */
function generateSitemap(url, outputPath) {
  return new Promise((resolve, reject) => {
    const options = {
      maxDepth: 0, // 無制限
      filepath: outputPath,
      maxEntriesPerFile: 50000,
      stripQuerystring: true,
    };

    const generator = SitemapGenerator(url, options);

    generator.on('done', () => {
      console.log('[完了] サイトマップ生成完了');
      resolve();
    });

    generator.on('error', (error) => {
      reject(error);
    });

    generator.start();
  });
}

/**
 * 既存のsitemap.xmlを取得して統合
 */
async function fetchAndMergeSitemap(sitemapUrl, outputPath) {
  try {
    // sitemap.xmlをダウンロード
    const xmlContent = await downloadFile(sitemapUrl);
    
    // XMLを解析
    const parsed = await parseStringPromise(xmlContent);
    
    // sitemap index形式かどうかを判定
    if (parsed.sitemapindex) {
      // sitemap index形式の場合、全てのsitemapを統合
      console.log('[処理] sitemap indexを検出、複数のsitemapを統合中...');
      const sitemaps = parsed.sitemapindex.sitemap || [];
      const allUrls = [];

      for (const sitemap of sitemaps) {
        const sitemapLoc = sitemap.loc[0];
        console.log(`[処理] ${sitemapLoc} を取得中...`);
        const sitemapContent = await downloadFile(sitemapLoc);
        const sitemapParsed = await parseStringPromise(sitemapContent);
        
        if (sitemapParsed.urlset && sitemapParsed.urlset.url) {
          allUrls.push(...sitemapParsed.urlset.url);
        }
      }

      // 統合したsitemap.xmlを生成
      await writeMergedSitemap(allUrls, outputPath);
    } else if (parsed.urlset) {
      // 通常のsitemap.xml形式の場合、そのまま保存
      await fs.writeFile(outputPath, xmlContent, 'utf-8');
    } else {
      throw new Error('無効なsitemap.xml形式です');
    }
  } catch (error) {
    throw new Error(`sitemap.xmlの取得・統合に失敗しました: ${error.message}`);
  }
}

/**
 * ファイルをダウンロード
 */
function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    client.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 統合したsitemap.xmlを書き込み
 */
async function writeMergedSitemap(urls, outputPath) {
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  const xmlFooter = '</urlset>\n';

  let xmlContent = xmlHeader;
  
  for (const url of urls) {
    const loc = url.loc[0];
    const lastmod = url.lastmod ? url.lastmod[0] : new Date().toISOString();
    const changefreq = url.changefreq ? url.changefreq[0] : 'weekly';
    const priority = url.priority ? url.priority[0] : '0.5';

    xmlContent += `  <url>\n`;
    xmlContent += `    <loc>${escapeXml(loc)}</loc>\n`;
    xmlContent += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
    xmlContent += `    <changefreq>${escapeXml(changefreq)}</changefreq>\n`;
    xmlContent += `    <priority>${escapeXml(priority)}</priority>\n`;
    xmlContent += `  </url>\n`;
  }

  xmlContent += xmlFooter;
  await fs.writeFile(outputPath, xmlContent, 'utf-8');
}

/**
 * sitemap.xmlを階層順にソート
 */
async function sortSitemapByDepth(sitemapPath) {
  try {
    // sitemap.xmlを読み込み
    const xmlContent = await fs.readFile(sitemapPath, 'utf-8');
    const parsed = await parseStringPromise(xmlContent);

    if (!parsed.urlset || !parsed.urlset.url) {
      return; // URLがなければ何もしない
    }

    // URLを階層順にソート
    const urls = parsed.urlset.url;
    urls.sort((a, b) => {
      const depthA = getUrlDepth(a.loc[0]);
      const depthB = getUrlDepth(b.loc[0]);
      
      // 階層が同じ場合はURLでソート
      if (depthA === depthB) {
        return a.loc[0].localeCompare(b.loc[0]);
      }
      
      return depthA - depthB;
    });

    // ソートしたsitemap.xmlを書き込み
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    const xmlFooter = '</urlset>\n';

    let sortedXmlContent = xmlHeader;
    
    for (const url of urls) {
      const loc = url.loc[0];
      const lastmod = url.lastmod ? url.lastmod[0] : new Date().toISOString();
      const changefreq = url.changefreq ? url.changefreq[0] : 'weekly';
      const priority = url.priority ? url.priority[0] : '0.5';

      sortedXmlContent += `  <url>\n`;
      sortedXmlContent += `    <loc>${escapeXml(loc)}</loc>\n`;
      sortedXmlContent += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
      sortedXmlContent += `    <changefreq>${escapeXml(changefreq)}</changefreq>\n`;
      sortedXmlContent += `    <priority>${escapeXml(priority)}</priority>\n`;
      sortedXmlContent += `  </url>\n`;
    }

    sortedXmlContent += xmlFooter;
    await fs.writeFile(sitemapPath, sortedXmlContent, 'utf-8');
  } catch (error) {
    console.error('[警告] サイトマップのソートに失敗しました:', error.message);
    // エラーが発生しても処理は続行
  }
}

/**
 * URLから階層の深さを取得
 */
function getUrlDepth(url) {
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
 * XMLエスケープ
 */
function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * ドメイン名を保存（zipコマンドで使用）
 */
async function saveDomain(url) {
  const urlObj = new URL(url);
  const domain = urlObj.hostname;
  const configPath = path.join(process.cwd(), 'dist', '.config.json');
  const config = { domain, url };
  
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// 実行
genSitemap();

