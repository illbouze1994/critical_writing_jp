const { build } = require('esbuild');
const fs = require('fs');
const { existsSync, mkdirSync } = fs;
const path = require('path');

// コマンドライン引数解析
const args = process.argv.slice(2);
const isDev = args.includes('--dev');
const isWatch = args.includes('--watch');

// ビルド設定
const buildOptions = {
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

async function buildExtension() {
  try {
    console.log(`🔨 Building extension (${isDev ? 'development' : 'production'})...`);
    
    const result = await build(buildOptions);
    
    // バンドルサイズ情報表示
    if (result.metafile) {
      const { outputs } = result.metafile;
      const mainOutput = outputs['dist/extension.js'];
      if (mainOutput) {
        const sizeKB = Math.round(mainOutput.bytes / 1024);
        console.log(`📦 Bundle size: ${sizeKB}KB`);
        
        // サイズ警告（2MB超過時）
        if (sizeKB > 2048) {
          console.warn('⚠️  Bundle size exceeds 2MB. Consider code splitting.');
        }
      }
    }
    
    // アセットをコピー
    copyAssets();

    console.log('✅ Build completed successfully!');
    return result;
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// ウォッチモード
if (isWatch) {
  console.log('👀 Starting watch mode...');
  const watchOptions = {
    ...buildOptions,
    plugins: [
      {
        name: 'rebuild-notify',
        setup(build) {
          build.onEnd(result => {
            if (result.errors.length === 0) {
              console.log('🔄 Rebuild completed at', new Date().toLocaleTimeString());
            }
          });
        }
      }
    ]
  };
  
  build({
    ...watchOptions,
    watch: true
  }).catch(() => process.exit(1));
} else {
  // 通常ビルド
  buildExtension();
}