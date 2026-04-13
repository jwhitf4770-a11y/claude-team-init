import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'https://codecrew-mu.vercel.app',
    screenshot: 'on',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e-report' }],
  ],
  outputDir: 'e2e-results',
});
