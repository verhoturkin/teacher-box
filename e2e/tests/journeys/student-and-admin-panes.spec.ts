import { startSession } from '../support/session';
import { expect, test, type Page } from '@playwright/test';

const RUN = Date.now().toString(36);
const LOGIN = `layout${RUN}`;
const PASSWORD = `pass-${RUN}`;
const NAME = `Аватар ${RUN}`;
const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

test.beforeAll(async ({ request }) => {
  const auth = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(auth.ok()).toBe(true);
  const { accessToken } = (await auth.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const response = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: NAME, email: null, phone: null, note: null },
  });
  expect(response.ok()).toBe(true);
  const { student, invite } = (await response.json()) as {
    student: { id: string; version: number };
    invite: { token: string };
  };
  const coloured = await request.put(`/api/teacher/students/${student.id}`, {
    headers,
    data: {
      displayName: NAME,
      email: null,
      phone: null,
      note: null,
      defaultTopic: null,
      color: 'VIOLET',
      version: student.version,
    },
  });
  expect(coloured.ok()).toBe(true);
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login: LOGIN, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
});

test('student colour is on the avatar while rows keep their neutral surface', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/students');
  const row = page.locator('li').filter({ hasText: NAME });
  await expect(row.locator('tb-avatar')).toHaveAttribute('data-tb-label', 'violet');
  await expect(row).not.toHaveAttribute('data-tb-label');
});

test('student schedule adapts from calendar panes to a day agenda', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, LOGIN, PASSWORD);
  await page.goto('/cabinet/schedule');
  await expect(page.locator('tb-schedule-calendar')).toBeVisible();
  await expect(page.locator('tb-mini-month')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('tb-schedule-agenda')).toBeVisible();
  await page.getByRole('button', { name: 'Неделя', exact: true }).click();
  await expect(page.locator('tb-schedule-calendar')).toBeVisible();
  await page.getByRole('button', { name: 'Повестка', exact: true }).click();
  await expect(page.locator('tb-schedule-agenda')).toBeVisible();
});

test('student payments show figures and filter the history', async ({ page }) => {
  await signIn(page, LOGIN, PASSWORD);
  await page.goto('/cabinet/billing');
  await expect(page.locator('.tb-my-billing-figure')).toHaveCount(4);
  const chips = page.getByRole('group', { name: 'Фильтр операций' });
  await chips.getByRole('button', { name: 'Оплаты', exact: true }).click();
  await expect(chips.getByRole('button', { name: 'Оплаты', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await chips.getByRole('button', { name: 'Занятия', exact: true }).click();
  await expect(chips.getByRole('button', { name: 'Занятия', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('administrator settings scroll fields while save and headings stay visible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/admin/settings/notifications');
  const scroll = page.locator('tb-pane').last().locator('.tb-pane__scroll');
  await expect(scroll.locator('.tb-setting').first()).toBeVisible();
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.getByRole('button', { name: 'Сохранить и перезапустить' })).toBeVisible();
  await expect(page.locator('tb-pane').last().locator('.tb-pane__header h2')).toBeVisible();
  expect(await scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test('administrator sees Drive copies and can bring one to the server', async ({ page }) => {
  await page.route('**/api/admin/backups/google', (route) =>
    route.fulfill({
      json: {
        clientConfigured: true,
        clientFromEnvironment: true,
        clientId: null,
        connected: true,
        account: null,
        connectedAt: '2026-10-22T00:00:00Z',
        lastUploadAt: null,
        lastUploadName: null,
        lastError: null,
        running: null,
        callbackPath: '/api/public/backups/google/callback',
      },
    }),
  );
  const copy = {
    id: 'cloud-copy',
    name: 'teacherbox-cloud.zip',
    size: 1024,
    createdAt: '2026-10-22T00:00:00Z',
  };
  await page.route('**/api/admin/backups/google/files', (route) => route.fulfill({ json: [copy] }));
  await page.route('**/api/admin/backups/google/files/cloud-copy/download', (route) =>
    route.fulfill({ status: 202, json: copy }),
  );
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/admin/backups');
  const panel = page.locator('tb-drive-panel');
  await expect(panel.getByText(copy.name, { exact: true })).toBeVisible();
  const request = page.waitForRequest('**/api/admin/backups/google/files/cloud-copy/download');
  await panel.getByRole('button', { name: new RegExp(copy.name) }).click();
  expect((await request).method()).toBe('POST');
  await expect(panel.locator('form')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/0.27.0-admin-backups.png', fullPage: true });
});
