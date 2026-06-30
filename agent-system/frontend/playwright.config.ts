import { defineConfig } from '@playwright/test'

const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || '41d97bd0b35d54627151f25f67eddcbf8d1c4c1cef3fb6d166bc94c2f29ab1e3'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:8420?token=${DASHBOARD_TOKEN}`,
    screenshot: 'on',
    trace: 'retain-on-failure',
    viewport: { width: 1400, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  outputDir: './e2e/test-results',
})
