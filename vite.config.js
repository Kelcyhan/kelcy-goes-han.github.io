import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const originalProjectDirectories = [
  'AISpeakingLab',
  'AgentSystem',
  'DiscussAgain',
  'MetacogReef',
  'PointFit',
  'Puri',
  'SupplyNet',
  'Swarm',
];

const runtimeDirectories = [
  ['assets/frames', 'assets/frames'],
  ['assets/fish', 'assets/fish'],
  ['Doliu', 'Doliu'],
  ['BetweenBayShop', 'BetweenBayShop'],
  ...originalProjectDirectories.map((name) => [name, name]),
];

function copyRuntimeAssets() {
  return {
    name: 'copy-runtime-assets',
    apply: 'build',
    async closeBundle() {
      const outDir = resolve(__dirname, 'dist');
      await Promise.all(runtimeDirectories.map(async ([source, destination]) => {
        const target = resolve(outDir, destination);
        await mkdir(resolve(target, '..'), { recursive: true });
        await cp(resolve(__dirname, source), target, { recursive: true });
      }));

      // Original pages stay byte-for-byte intact and keep their historical
      // relative URLs. Copy the shared back control and the Agent System
      // root-level runtime files to those exact published locations.
      await mkdir(resolve(outDir, 'assets'), { recursive: true });
      await cp(resolve(__dirname, 'assets/project-back.js'), resolve(outDir, 'assets/project-back.js'));
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
