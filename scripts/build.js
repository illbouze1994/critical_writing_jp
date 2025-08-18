const { build } = require('esbuild');
const fs = require('fs');
const { existsSync, mkdirSync } = fs;
const path = require('path');

// コマンドライン引数解析
const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const isWatch = args.includes('--watch');

// ビルド設定: Extension Host
const extensionBuildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  sourcemap: isDev,
  minify: !isDev,
  metafile: true,
  treeShaking: true,
  format: 'cjs',
  logLevel: 'info'
};

// ビルド設定: Webview UI (React)
const webviewBuildOptions = {
  entryPoints: ['webview-ui/src/index.tsx'],
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  outfile: 'dist/webview.js',
  sourcemap: isDev,
  minify: !isDev,
  metafile: true,
  treeShaking: true,
  format: 'esm',
  logLevel: 'info',
  jsx: 'automatic'
};

// distディレクトリが存在しない場合は作成
const distDir = path.resolve(__dirname, '..', 'dist');
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

function copyAssets() {
  console.log('📂 Copying assets...');
  try {
    // Kuromoji辞書ファイルをコピー
    const kuromojiSrc = path.resolve(__dirname, '..', 'node_modules', 'kuromoji', 'dict');
    const kuromojiDest = path.resolve(__dirname, '..', 'dist', 'dict');
    if (fs.existsSync(kuromojiSrc)) {
      if (!fs.existsSync(kuromojiDest)) {
        fs.mkdirSync(kuromojiDest, { recursive: true });
      }
      fs.cpSync(kuromojiSrc, kuromojiDest, { recursive: true });
      console.log('  - Kuromoji dictionary copied to dist/dict');
    } else {
      console.warn('  - Kuromoji dictionary source not found, skipping copy.');
    }

    // webview-assetsをコピー
    const webviewAssetsSrc = path.resolve(__dirname, '..', 'webview-assets');
    const webviewAssetsDest = path.resolve(__dirname, '..', 'dist', 'webview-assets');
    if (fs.existsSync(webviewAssetsSrc)) {
      if (!fs.existsSync(webviewAssetsDest)) {
        fs.mkdirSync(webviewAssetsDest, { recursive: true });
      }
      fs.cpSync(webviewAssetsSrc, webviewAssetsDest, { recursive: true });
      console.log('  - Webview assets copied to dist/webview-assets');
    } else {
      // webview-assets はオプションではないので警告を出す
      console.warn('  - webview-assets directory not found, skipping copy.');
    }

    console.log('  ✅ Assets copied successfully!');
  } catch (error) {
    console.error('  ❌ Asset copying failed:', error);
    process.exit(1);
  }
}

async function buildAll() {
  try {
    console.log(`🔨 Building all targets (${isDev ? 'development' : 'production'})...`);

    // Extension HostとWebview UIを並列でビルド
    const [extensionResult, webviewResult] = await Promise.all([
      build(extensionBuildOptions),
      build(webviewBuildOptions)
    ]);

    // バンドルサイズ情報表示
    logBundleSize(extensionResult.metafile, 'dist/extension.js', 'Extension Host');
    logBundleSize(webviewResult.metafile, 'dist/webview.js', 'Webview UI');
    
    // アセットをコピー
    copyAssets();

    console.log('✅ Build completed successfully!');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

function logBundleSize(metafile, outputPath, name) {
  if (metafile) {
    const { outputs } = metafile;
    const output = outputs[outputPath];
    if (output) {
      const sizeKB = Math.round(output.bytes / 1024);
      console.log(`📦 [${name}] Bundle size: ${sizeKB}KB`);

      // サイズ警告
      const sizeLimit = name === 'Extension Host' ? 2048 : 1024;
      if (sizeKB > sizeLimit) {
        console.warn(`⚠️  [${name}] Bundle size exceeds ${sizeLimit}KB. Consider optimization.`);
      }
    }
  }
}

// ウォッチモード
if (isWatch) {
  console.log('👀 Starting watch mode...');

  const watchOptions = {
    plugins: [
      {
        name: 'rebuild-notify',
        setup(build) {
          build.onEnd(result => {
            if (result.errors.length === 0) {
              console.log(`🔄 [${build.initialOptions.entryPoints[0]}] Rebuild completed at`, new Date().toLocaleTimeString());
            }
          });
        }
      }
    ]
  };

  // Extension HostとWebview UIの両方をウォッチ
  build({ ...extensionBuildOptions, ...watchOptions, watch: true }).catch(() => process.exit(1));
  build({ ...webviewBuildOptions, ...watchOptions, watch: true }).catch(() => process.exit(1));
  
  // アセットは初回のみコピー
  copyAssets();

} else {
  // 通常ビルド
  buildAll();
}