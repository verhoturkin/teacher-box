import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.9.3: Google Sans; billing (balances and a student's history) and the teacher's boards are lists
 * like «Ученики», not tables, also on a phone; read notifications move into the folded «Прочитанные».
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Список оплат ${RUN}`;
const BOARD = `Доска списком ${RUN}`;
const LOGIN = `list${RUN}`;
const PASSWORD = `pass-${RUN}-list`;

test.describe.configure({ mode: 'serial' });

let studentId = '';

async function bearer(
  request: APIRequestContext,
  login = 'teacher',
  password = TEACHER_PASSWORD,
): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function signIn(page: Page, width = 1280, login = 'teacher', password = TEACHER_PASSWORD) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student, invite } = (await created.json()) as {
    student: { id: string };
    invite: { token: string };
  };
  studentId = student.id;
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login: LOGIN, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
  const today = new Date().toISOString().slice(0, 10);
  for (const amount of [100_000, 200_000]) {
    const paid = await request.post('/api/teacher/billing/payments', {
      headers,
      data: { studentId, amount, paidOn: today, comment: 'Перевод' },
    });
    expect(paid.ok()).toBe(true);
  }
  const board = await request.post('/api/teacher/boards', {
    headers,
    data: { kind: 'EXCALIDRAW', title: BOARD, url: null, studentIds: [studentId], groupIds: [] },
  });
  expect(board.ok()).toBe(true);
});

test('the interface font is Google Sans', async ({ page }) => {
  await signIn(page);
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family).toContain('Google Sans');
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('16px "Google Sans Variable"')))
    .toBe(true);
});

test('the balances are a list, the balance goes under the name on a phone', async ({ page }) => {
  await signIn(page, 390);
  await page.goto('/teacher/billing');
  await expect(page.locator('.p-datatable')).toHaveCount(0);
  const row = page
    .locator('ul.tb-list[aria-label="Балансы учеников"] > li')
    .filter({ hasText: STUDENT });
  await expect(row).toContainText('аванс 3 000 ₽');
  await expect(row).toContainText('за занятие');

  const name = await row.locator('.tb-list__title').boundingBox();
  const balance = await row.locator('.tb-list__amount').boundingBox();
  expect(balance?.y ?? 0).toBeGreaterThan((name?.y ?? 0) + (name?.height ?? 0) - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('a student history is a list with amounts', async ({ page }) => {
  await signIn(page);
  await page.goto(`/teacher/billing/students/${studentId}`);
  const rows = page.locator('ul.tb-list[aria-label="История"] > li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('+2 000 ₽');
  await expect(rows.first()).toContainText('Перевод');
  await expect(page.getByRole('button', { name: /^Аннулировать оплату от / })).toHaveCount(2);
});

test('boards are a list with a row menu', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/boards');
  const row = page.locator('ul.tb-list[aria-label="Доски"] > li').filter({ hasText: BOARD });
  await expect(row).toContainText('Доска Excalidraw');
  await expect(row).toContainText(STUDENT);

  await row.getByRole('button', { name: `Действия: ${BOARD}` }).click();
  await expect(page.getByRole('menuitem', { name: 'Резервные копии' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Изменить' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Изменить' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('a read notification moves into the folded «Прочитанные»', async ({ page }) => {
  await signIn(page, 1280, LOGIN, PASSWORD);
  await page.goto('/cabinet/notifications');
  const unread = page.locator('ul[aria-label="Непрочитанные"] > li');
  await expect(unread.filter({ hasText: 'Получена оплата 2 000 ₽' })).toBeVisible({
    timeout: 20_000,
  });
  const toggle = page.getByRole('button', { name: 'Прочитанные' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await unread
    .filter({ hasText: 'Получена оплата 2 000 ₽' })
    .getByRole('button', { name: 'Отметить прочитанным' })
    .click();
  await expect(unread.filter({ hasText: 'Получена оплата 2 000 ₽' })).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.locator('ul[aria-label="Прочитанные уведомления"] > li').filter({
      hasText: 'Получена оплата 2 000 ₽',
    }),
  ).toBeVisible();
});
