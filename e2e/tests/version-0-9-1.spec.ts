import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.9.1: a student's photo and own name (the teacher keeps the name they gave), the favicon, the
 * round logo, and the teacher's settings on a phone — backups with a «⋮» menu, a full-screen reset dialog.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Вероника Фото ${RUN}`;
const OWN_NAME = `Ника ${RUN}`;
/** A 1×1 PNG: the browser crops and scales it like any photo. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.describe.configure({ mode: 'serial' });

let login = '';
let password = '';

async function bearer(request: APIRequestContext): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function signIn(page: Page, user: string, secret: string, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(user);
  await page.locator('#password').fill(secret);
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
  login = `photo${RUN}`;
  password = `pass-${RUN}-photo`;
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login, password },
  });
  expect(accepted.ok()).toBe(true);
});

test('the browser tab has the Teacher Box icon', async ({ request }) => {
  for (const icon of ['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png']) {
    expect((await request.get(icon)).ok()).toBe(true);
  }
  // the page as served (the portal logo of another scenario replaces the icons only in the browser)
  const page = await (await request.get('/login')).text();
  expect(page).toContain('<link rel="icon" type="image/svg+xml" href="favicon.svg"');
  expect(page).toContain('<link rel="apple-touch-icon" href="apple-touch-icon.png"');
});

test('a student sets a photo and an own name; the teacher keeps the name they gave', async ({
  browser,
}) => {
  const student = await (await browser.newContext()).newPage();
  await signIn(student, login, password);
  await student.goto('/cabinet/account');
  await student
    .locator('input[type="file"][aria-label="Файл фото"]')
    .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(student.getByText('Фото сохранено')).toBeVisible();
  await expect(student.locator('.tb-shell__user-button tb-avatar img')).toBeVisible();

  await student.locator('#account-own-name').fill(OWN_NAME);
  await student.getByRole('button', { name: 'Сохранить' }).first().click();
  await expect(student.getByText('Имя сохранено')).toBeVisible();
  await expect(student.locator('.tb-shell__user-button')).toContainText(OWN_NAME);
  await expect(student.getByText(`Учитель видит вас как «${STUDENT}»`)).toBeVisible();

  const teacher = await (await browser.newContext()).newPage();
  await signIn(teacher, 'teacher', TEACHER_PASSWORD);
  await teacher.goto('/teacher/students');
  const row = teacher
    .getByRole('list', { name: 'Ученики' })
    .getByRole('listitem')
    .filter({ hasText: STUDENT });
  await expect(row.locator('tb-avatar img')).toBeVisible();
  await expect(teacher.getByText(OWN_NAME)).toHaveCount(0);
});

test('the teacher settings on a phone: backups menu and a full-screen reset dialog', async ({
  page,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 375);
  await page.goto('/teacher/settings');
  await expect(page.locator('.tb-shell__brand tb-portal-logo')).toBeVisible();

  const backups = page.locator('#backups');
  await backups.getByRole('button', { name: 'Создать копию сейчас' }).click();
  await expect(page.getByText(/^Копия .+ создана$/)).toBeVisible({ timeout: 30_000 });
  const actions = backups.getByRole('button', { name: /^Действия: / }).first();
  await actions.click();
  await expect(actions).toHaveAttribute('aria-expanded', 'true');
  for (const item of ['Восстановить…', 'Скачать', 'Удалить…']) {
    await expect(page.getByRole('menuitem', { name: item })).toBeVisible();
  }
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Сбросить все данные…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сбросить все данные?' });
  await expect(dialog).toBeVisible();
  // full screen once the opening animation is over
  await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBe(375);
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(dialog).toBeHidden();
});
