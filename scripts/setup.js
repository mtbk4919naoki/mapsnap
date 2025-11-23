const fs = require('fs').promises;
const path = require('path');

/**
 * setupコマンド
 * ディレクトリの作成とクリーンアップを行う
 */
async function setup() {
  try {
    const distDir = path.join(process.cwd(), 'dist');
    const screenshotDir = path.join(distDir, 'screenshot');
    const outputDir = path.join(process.cwd(), 'output');

    console.log('[処理] ディレクトリを作成中...');

    // ディレクトリ作成
    await fs.mkdir(distDir, { recursive: true });
    await fs.mkdir(screenshotDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    console.log('[完了] ディレクトリ作成完了');

    // クリーンアップ
    console.log('[処理] 既存ファイルをクリーンアップ中...');
    await cleanupDirectory(distDir);
    console.log('[完了] クリーンアップ完了');

    console.log('[完了] セットアップが完了しました');
  } catch (error) {
    console.error('[エラー] セットアップ中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

/**
 * ディレクトリ内のファイルを削除（ディレクトリ自体は保持）
 */
async function cleanupDirectory(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // ディレクトリの場合は再帰的に削除
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        // ファイルの場合は削除
        await fs.unlink(fullPath);
      }
    }
  } catch (error) {
    // ディレクトリが空の場合はエラーを無視
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

// 実行
setup();

