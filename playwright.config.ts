import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'test/browser',
  workers: 1,
  timeout: 30_000,
  outputDir: 'work/browser-results',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
      : undefined,
  },
  webServer: {
    command: 'npm run build && node dist-server/server/index.js',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: '3100',
      DATABASE_URL: '',
      PUBLIC_ORIGIN: 'http://127.0.0.1:3100',
      MANUS_JWT_SECRET: 'browser-test-only-secret',
      MANUS_PROJECT_ID: 'browser-tests',
    },
  },
});
