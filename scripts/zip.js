const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const archiver = require('archiver');

/**
 * zipコマンド
 * distディレクトリ内のファイルをzip化する
 */
async function createZip() {
  try {
    const distDir = path.join(process.cwd(), 'dist');
    const configPath = path.join(distDir, '.config.json');

    // ドメイン名を取得
    let domain;
    try {
      const configContent = await fsPromises.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      domain = config.domain;
    } catch (error) {
      throw new Error('ドメイン情報が見つかりません。先に gen-sitemap コマンドを実行してください。');
    }

    // 出力ディレクトリを作成
    const outputDir = path.join(process.cwd(), 'output');
    await fsPromises.mkdir(outputDir, { recursive: true });

    // タイムスタンプを生成（YYYYMMDD_HHMMSS形式）
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;

    const zipFilename = `${domain}_generated_${timestamp}.zip`;
    const zipPath = path.join(outputDir, zipFilename);

    console.log('[処理] zipファイルを作成中...');
    await zipDirectory(distDir, zipPath);
    console.log(`[完了] zipファイルを作成しました: ${zipPath}`);
  } catch (error) {
    console.error('[エラー] zipファイル作成中にエラーが発生しました:', error.message);
    process.exit(1);
  }
}

/**
 * ディレクトリをzip化
 */
async function zipDirectory(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // 最高圧縮
    });

    output.on('close', () => {
      console.log(`[完了] ${archive.pointer()} バイトのzipファイルを作成しました`);
      resolve();
    });

    archive.on('error', (error) => {
      reject(error);
    });

    archive.pipe(output);

    // ディレクトリ内のファイルを再帰的に追加（.config.jsonは除外）
    addDirectoryToArchive(sourceDir, sourceDir, archive)
      .then(() => {
        archive.finalize();
      })
      .catch(reject);
  });
}

/**
 * ディレクトリ内のファイルを再帰的にアーカイブに追加
 */
async function addDirectoryToArchive(sourceDir, currentDir, archive) {
  const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(sourceDir, fullPath);

    // .config.jsonを除外
    if (entry.name === '.config.json') {
      continue;
    }

    if (entry.isDirectory()) {
      await addDirectoryToArchive(sourceDir, fullPath, archive);
    } else {
      archive.file(fullPath, { name: relativePath });
    }
  }
}

// 実行
createZip();

