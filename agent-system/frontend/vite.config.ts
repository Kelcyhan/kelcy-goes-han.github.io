import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const useMocks = env.VITE_USE_MOCKS === '1'

  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@widgets': path.resolve(__dirname, '../../vault/widgets'),
        ...(useMocks ? { '@clerk/react': path.resolve(__dirname, './src/mocks/clerk-stub.tsx') } : {}),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      port: 5173,
      fs: {
        allow: ['..', '../../vault/widgets'],
      },
      proxy: useMocks
        ? undefined
        : {
            '/api': {
              target: 'http://localhost:8420',
              changeOrigin: true,
              ws: true,
            },
          },
    },
    build: {
      outDir: 'dist',
    },
  }
})
