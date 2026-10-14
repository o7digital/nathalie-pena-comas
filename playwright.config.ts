import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: './tests', fullyParallel: true, workers: 2,
 use: { baseURL: process.env.TEST_BASE_URL || 'http://localhost:4322', headless: true, launchOptions: { channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' } },
 webServer: process.env.TEST_BASE_URL ? undefined : { command: 'npm run preview -- --port 4322', url: 'http://localhost:4322/es/', reuseExistingServer: true },
});
