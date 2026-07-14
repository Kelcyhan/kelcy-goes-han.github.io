import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const runtimeCopies = [
  ['assets/frames', 'assets/frames'],
  ['AgentSystem/demo', 'demos/agent-system'],
  ['SupplyNet/sandbox', 'demos/supply-net'],
  ['Swarm/sandbox', 'demos/swarm'],
];

function copyRuntimeAssets() {
  return {
    name: 'copy-runtime-assets',
    apply: 'build',
    async closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      await Promise.all(runtimeCopies.map(async ([source, destination]) => {
        const target = resolve(outDir, destination);
        await mkdir(target, { recursive: true });
        await cp(resolve(__dirname, source), target, { recursive: true });
      }));

      // The Agent System static build still asks for these two support files at
      // the domain root. Keep the published demo self-contained without
      // modifying its generated bundle.
      await cp(resolve(__dirname, 'AgentSystem/demo/noise.png'), resolve(outDir, 'noise.png'));
      await cp(resolve(__dirname, 'AgentSystem/demo/audio-processor.js'), resolve(outDir, 'audio-processor.js'));
    },
  };
}

export default defineConfig({
  plugins: [react(), copyRuntimeAssets()],
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: '0.0.0.0',
  },
  preview: {
    host: '0.0.0.0',
  },
});
