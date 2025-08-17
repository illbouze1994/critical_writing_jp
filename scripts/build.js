const { build } = require('esbuild');
const { existsSync, mkdirSync } = require('fs');
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