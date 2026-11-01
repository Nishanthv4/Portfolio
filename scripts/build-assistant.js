import { build } from 'vite';
import fs from 'fs';
import path from 'path';

async function bundleAssistant() {
  console.log('[build-assistant] Compiling optimized AI assistant modules from src/ ...');

  // Build src/main.js to assets/
  await build({
    configFile: false,
    base: './',
    build: {
      target: 'esnext',
      outDir: '.temp_ai_build',
      emptyOutDir: true,
      minify: 'esbuild',
      rollupOptions: {
        input: {
          index: path.resolve(process.cwd(), 'src/main.js')
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  });

  const tempAssets = path.resolve(process.cwd(), '.temp_ai_build/assets');
  const targetAssets = path.resolve(process.cwd(), 'assets');

  if (fs.existsSync(tempAssets)) {
    const files = fs.readdirSync(tempAssets);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const srcPath = path.join(tempAssets, file);
        let destName = file;
        if (file.startsWith('ai-worker')) {
          destName = 'ai-worker.js';
        }
        const destPath = path.join(targetAssets, destName);
        fs.copyFileSync(srcPath, destPath);
        console.log(`[build-assistant] Synchronized ${destName} -> assets/`);
      }
    }
  }

  // Cleanup temp dir
  fs.rmSync(path.resolve(process.cwd(), '.temp_ai_build'), { recursive: true, force: true });
  console.log('[build-assistant] AI assistant modules successfully bundled and synchronized.');
}

bundleAssistant().catch(err => {
  console.error('[build-assistant] Error bundling AI assistant:', err);
  process.exit(1);
});
