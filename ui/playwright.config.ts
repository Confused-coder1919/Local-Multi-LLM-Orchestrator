import { defineConfig } from '@playwright/test';

const uiUrl = process.env.UI_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  timeout: 240000,
  expect: {
    timeout: 240000
  },
  retries: 0,
  reporter: 'list',
  outputDir: 'test-artifacts',
  use: {
    baseURL: uiUrl,
    headless: true
  }
});
