import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.9.2: students' photos in billing (and other lists), the teacher's photo, «Мой аккаунт» and the
 * teacher's «Настройки» full width (folding sections, no «Интеграции», «Профиль» or address), no section
 * titles on a phone.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Фото в оплатах ${RUN}`;
/** A 1×1 PNG: the server checks the type by its first bytes. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.describe.configure({ mode: 'serial' });

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

async function signIn(page: Page, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.beforeAll(async ({ request }) => {
  const created = await request.post('/api/teacher/students', {
    headers: await bearer(request),
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { invite } = (await created.json()) as { invite: { token: string } };
  const login = `pay${RUN}`;
  const password = `pass-${RUN}-pay`;
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login, password },
  });
  expect(accepted.ok()).toBe(true);
  const photo = await request.put('/api/me/avatar', {
    headers: await bearer(request, login, password),
    multipart: { file: { name: 'me.png', mimeType: 'image/png', buffer: PNG } },
  });
  expect(photo.ok()).toBe(true);
});

test('the teacher sees the student photo in «Оплаты»', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/billing');
  const row = page.locator('.tb-list > li').filter({ hasText: STUDENT });
  await expect(row.locator('tb-avatar img')).toBeVisible();
});

test('the teacher sets a photo in a full-width «Мой аккаунт»', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/account');
  await expect(page.locator('.tb-account__role')).toHaveText('Учитель');
  await page
    .locator('input[type="file"][aria-label="Файл фото"]')
    .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Фото сохранено')).toBeVisible();
  await expect(page.locator('.tb-shell__user-button tb-avatar img')).toBeVisible();

  // «Имя» and «Смена пароля» side by side
  const cards = page.locator('.tb-account__forms > p-card');
  await expect(cards).toHaveCount(2);
  const [name, password] = await Promise.all([
    cards.nth(0).boundingBox(),
    cards.nth(1).boundingBox(),
  ]);
  expect(Math.round(name?.y ?? 0)).toBe(Math.round(password?.y ?? 1));

  await page.getByRole('button', { name: 'Убрать фото' }).click();
  await expect(page.locator('.tb-shell__user-button tb-avatar img')).toHaveCount(0);
});

test('the settings fold, without integrations, profile or address', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/settings');
  const main = page.locator('main');
  for (const section of ['Портал', 'Календарь и звонки', 'Неудачные доставки', 'Данные']) {
    await expect(main.getByRole('button', { name: new RegExp(`^${section}`) })).toBeVisible();
  }
  await expect(main).not.toContainText('Интеграции');
  await expect(main).not.toContainText('Профиль');
  await expect(page.locator('#portal')).toHaveCount(0);

  await main.getByRole('button', { name: /^Портал/ }).click();
  await expect(page).toHaveURL(/open=portal/);
  await expect(page.locator('#portal-name')).toBeVisible();
  await expect(page.locator('#portal-address')).toHaveCount(0);
});

test('a phone shows no section titles; nested pages keep theirs', async ({ page }) => {
  await signIn(page, 375);
  await page.goto('/teacher/students');
  const title = page.locator('h1.tb-page-title');
  await expect(title).toHaveText('Ученики');
  await expect.poll(async () => (await title.boundingBox())?.height ?? 0).toBeLessThanOrEqual(1);

  await page.goto('/teacher/billing/report');
  await expect(page.locator('h1.tb-page-title')).toBeVisible();
  await expect(
    page.locator('main').getByRole('link', { name: 'Оплаты', exact: true }),
  ).toBeVisible();
});
