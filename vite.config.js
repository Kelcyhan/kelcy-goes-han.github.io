import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const projectPages = [
  'AISpeakingLab',
  'AgentSystem',
  'DiscussAgain',
  'MetacogReef',
  'PointFit',
  'Puri',
  'SupplyNet',
  'Swarm',
];

// Frame sequences and the GLB are addressed dynamically at runtime, so Vite
// cannot discover them from static imports. Copy them with their original URL
// structure after every build instead of relying on the dev server's fallback.
function copyRuntimeAssets() {
  const runtimeAssetDirs = ['frames', 'fish'];

  return {
    name: 'copy-runtime-assets',
    apply: 'build',
    async closeBundle() {
      const outputAssets = resolve(__dirname, 'dist/assets');
      await mkdir(outputAssets, { recursive: true });
      await Promise.all(runtimeAssetDirs.map((dir) => cp(
        resolve(__dirname, 'assets', dir),
        resolve(outputAssets, dir),
        { recursive: true },
      )));
      // The Agent System prototype is already a self-contained production
      // bundle. Its nested assets are runtime-relative and must stay together.
      await cp(
        resolve(__dirname, 'AgentSystem/demo'),
        resolve(__dirname, 'dist/AgentSystem/demo'),
        { recursive: true },
      );
      await cp(
        resolve(__dirname, 'AgentSystem/demo-preview.png'),
        resolve(__dirname, 'dist/AgentSystem/demo-preview.png'),
      );
    },
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [copyRuntimeAssets()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...Object.fromEntries(
          projectPages.map((name) => [name, resolve(__dirname, name, 'index.html')]),
        ),
      },
    },
  },
  server: {
    host: '0.0.0.0',
  },
  preview: {
    host: '0.0.0.0',
  },
});
