import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Build content script as IIFE (no module imports allowed in content scripts)
async function buildContentScript() {
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/content/content.js'),
        name: 'PhishingDetectorContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });
  console.log('✅ Content script built');
}

// Build background service worker as IIFE
async function buildBackground() {
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/background/background.js'),
        name: 'PhishingDetectorBackground',
        formats: ['iife'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });
  console.log('✅ Background script built');
}

async function main() {
  console.log('🔨 Building content script...');
  await buildContentScript();
  
  console.log('🔨 Building background script...');
  await buildBackground();
  
  console.log('🎉 All scripts built successfully!');
}

main().catch(console.error);
