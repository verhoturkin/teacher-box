import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against an already started instance (see scripts/e2e.sh):
 * E2E_BASE_URL (default http://localhost:8091) and the teacher password E2E_TEACHER_PASSWORD.
 * E2E_BROWSER_CHANNEL=chrome uses the installed Chrome instead of the bundled Chromium.
 * Under CI the report is a blob (one per instance, merged by the workflow); E2E_OUTPUT_DIR moves
 * the artifacts of a run, so that instances started in parallel (E2E_SHARDS) do not overwrite them.
 */
const channel = process.env['E2E_BROWSER_CHANNEL'];

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env['CI'] !== undefined,
  retries: process.env['CI'] === undefined ? 0 : 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: process.env['E2E_OUTPUT_DIR'] ?? 'test-results',
  reporter: process.env['CI'] === undefined ? 'list' : [['list'], ['blob']],
  use: {
    ...devices['Desktop Chrome'],
    ...(channel === undefined ? {} : { channel }),
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:8091',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['camera', 'microphone'],
    // The service worker answers fetches itself, so page.route() mocks never see them; only web-push.spec.ts opts in.
    serviceWorkers: 'block',
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/operations/**',
    },
    {
      name: 'operations',
      testMatch: '**/operations/**/*.spec.ts',
      dependencies: ['chromium'],
    },
  ],
});
