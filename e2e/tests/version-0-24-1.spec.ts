import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.24.1, UI fixes after 0.24.0: the rail brand stands in the row of the top strip, the student card
 * has M3 primary tabs (a tab list with the active one selected), and Today shows the queue and the week by the sketches.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const NAME = `Вкладки ${RUN}`;
const WIDE = { width: 1440, height: 900 };

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize(WIDE);
  await page.goto('/login');
  await page.locator('#login').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

let studentId = '';

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(login.ok()).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const created = await request.post('/api/teacher/students', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { displayName: NAME, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  studentId = ((await created.json()) as { student: { id: string } }).student.id;
});

test('the rail brand stands in the row of the top strip', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher');
  const brand = page.locator('.tb-side-nav__brand');
  const strip = page.locator('.tb-shell__header');
  await expect(brand).toBeVisible();
  await expect(strip).toBeVisible();
  const brandBox = await brand.boundingBox();
  const stripBox = await strip.boundingBox();
  expect(brandBox).not.toBeNull();
  expect(stripBox).not.toBeNull();
  const brandCentre = (brandBox?.y ?? 0) + (brandBox?.height ?? 0) / 2;
  const stripCentre = (stripBox?.y ?? 0) + (stripBox?.height ?? 0) / 2;
  expect(Math.abs(brandCentre - stripCentre)).toBeLessThanOrEqual(4);
});

test('Today shows the queue and the week', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher');
  await expect(page.getByText('Нужно сделать').first()).toBeVisible();
  await expect(page.getByText('Неделя').first()).toBeVisible();
});

test('the student card has M3 tabs', async ({ page }) => {
  await signIn(page);
  await page.goto(`/teacher/students/${studentId}`);
  const tabs = page.getByRole('tablist');
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'Обзор' })).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', { name: 'Профиль' }).click();
  await expect(tabs.getByRole('tab', { name: 'Профиль' })).toHaveAttribute('aria-selected', 'true');
  // M3 primary tabs: a divider under the bar, no filled container
  const bar = page.locator('.p-tablist-tab-list');
  await expect(bar).toHaveCSS('border-bottom-width', '1px');
  await expect(bar).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});
