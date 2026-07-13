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

export default defineConfig({
  appType: 'mpa',
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
