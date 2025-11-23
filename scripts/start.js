const readline = require('readline');
const { execSync, spawn } = require('child_process');
const path = require('path');

/**
 * 対話式コマンドランナー
 * 一連のコマンドを対話式で実行する
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * 質問をして回答を取得
 */
function question(query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Node.jsスクリプトを実行
 */
function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      shell: false,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log('=== サイトマップ・スクリーンショット取得ツール ===\n');

    // 1. セットアップ
    console.log('[1/4] セットアップを実行します...');
    execSync('npm run setup', { stdio: 'inherit' });
    console.log('');

    // 2. サイトマップ生成
    console.log('[2/4] サイトマップの生成・取得');
    const url = await question('サイトのURLを入力してください: ');
    if (!url) {
      console.error('[エラー] URLが入力されていません');
      process.exit(1);
    }

    const genSitemapScript = path.join(__dirname, 'gen-sitemap.js');
    const genSitemapArgs = [url];
    
    const sitemapUrl = await question('既存のsitemap.xmlのURLを入力してください（空欄の場合は自動生成）: ');
    if (sitemapUrl) {
      genSitemapArgs.push('-m', sitemapUrl);
    }

    console.log(`\n実行コマンド: node ${genSitemapScript} ${genSitemapArgs.join(' ')}`);
    await runScript(genSitemapScript, genSitemapArgs);
    console.log('');

    // 3. スクリーンショット取得
    console.log('[3/4] スクリーンショットの取得');
    const sitemapPath = './dist/sitemap.xml'; // startコマンドでは常にdist/sitemap.xmlを使用
    
    // オプション設定
    const depth = await question('階層の深さ (-1=無制限) [-1]: ') || '-1';
    const repeat = await question('各階層での取得上限 (0=無制限) [9]: ') || '9';
    const limit = await question('全体の取得上限 (0=無制限) [100]: ') || '100';
    const autoContinue = await question('エラー時に自動続行しますか？ (y/n) [n]: ');
    
    const getScreenshotScript = path.join(__dirname, 'get-screenshot.js');
    const getScreenshotArgs = [sitemapPath, '-d', depth, '-r', repeat, '-l', limit];
    if (autoContinue.toLowerCase() === 'y' || autoContinue.toLowerCase() === 'yes') {
      getScreenshotArgs.push('-y');
    }

    console.log(`\n実行コマンド: node ${getScreenshotScript} ${getScreenshotArgs.join(' ')}`);
    await runScript(getScreenshotScript, getScreenshotArgs);
    console.log('');

    // 4. zip化
    console.log('[4/4] zipファイルの作成');
    const createZip = await question('zipファイルを作成しますか？ (y/n) [y]: ') || 'y';
    
    if (createZip.toLowerCase() === 'y' || createZip.toLowerCase() === 'yes') {
      console.log('\n実行コマンド: npm run zip');
      execSync('npm run zip', { stdio: 'inherit' });
      console.log('');
    }

    console.log('[完了] すべての処理が完了しました');
  } catch (error) {
    console.error('[エラー] 処理中にエラーが発生しました:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// 実行
main();

