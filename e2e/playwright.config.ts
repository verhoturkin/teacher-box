import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against an already started instance (see scripts/e2e.sh):
 * E2E_BASE_URL (default http://localhost:8091) and the teacher password E2E_TEACHER_PASSWORD.
 * E2E_BROWSER_CHANNEL=chrome uses the installed Chrome instead of the bundled Chromium.
 */
const channel = process.env['E2E_BROWSER_CHANNEL'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env['CI'] !== undefined,
  retries: process.env['CI'] === undefined ? 0 : 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8091',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: channel === undefined ? { ...devices['Desktop Chrome'] } : { ...devices['Desktop Chrome'], channel },
    },
  ],
});
