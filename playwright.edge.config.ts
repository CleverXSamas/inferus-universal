import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'test/browser-edge',
  workers: 1,
  timeout: 30_000,
  outputDir: 'work/browser-edge-results',
  use: {
    baseURL: 'http://127.0.0.1:3103',
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
      : undefined,
  },
  webServer: {
    command:
      'npm run build:sites && npx tsc -p tsconfig.test.json && node test/helpers/edge-preview.mjs',
    url: 'http://127.0.0.1:3103/api/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
