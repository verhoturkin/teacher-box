import { startSession, bearer } from '../support/session';
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

async function signIn(page: Page, user: string, secret: string, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await startSession(page, user, secret);
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
  await expect(student.locator('a[aria-label^="Аккаунт"] tb-avatar img')).toBeVisible();

  await student.locator('#account-own-name').fill(OWN_NAME);
  await student.getByRole('button', { name: 'Сохранить' }).first().click();
  await expect(student.getByText('Имя сохранено')).toBeVisible();
  // the name is in the accessible name of the rail's «Аккаунт»
  await expect(student.locator('a[aria-label^="Аккаунт"]')).toHaveAttribute(
    'aria-label',
    `Аккаунт: ${OWN_NAME}`,
  );
  // 0.40.1: the item shows the name; «Выйти» is the last of the student's account page
  await expect(student.locator('a[aria-label^="Аккаунт"]')).toContainText(OWN_NAME);
  await expect(student.locator('tb-account-panel > .tb-stack > :last-child')).toHaveText(/Выйти/);
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
  await page.goto('/teacher/settings?open=data');
  // 0.21.0: the top app bar names the section; the brand is at the top of the ☰ rail
  await expect(page.locator('.tb-shell__title')).toHaveText('Настройки');

  const backups = page.locator('#backups');
  const pane = page.locator('tb-pane').filter({ has: backups });
  await pane
    .locator('.tb-pane__header')
    .getByRole('button', { name: 'Создать копию сейчас', exact: true })
    .click();
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
  await dialog.getByRole('button', { name: 'Закрыть' }).click();
  await expect(dialog).toBeHidden();
});

test('student access is disabled beside password reset and restored from Profile', async ({
  page,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/students');
  const row = page
    .getByRole('list', { name: 'Ученики' })
    .getByRole('listitem')
    .filter({ hasText: STUDENT });
  await row.getByRole('link', { name: STUDENT, exact: true }).click();
  await page.getByRole('tab', { name: 'Профиль' }).click();
  const reset = page.getByRole('button', { name: 'Сбросить пароль', exact: true });
  const disable = page.getByRole('button', { name: 'Отключить доступ…', exact: true });
  await expect(reset).toBeVisible();
  await expect(disable).toBeVisible();
  const resetBox = await reset.boundingBox();
  const disableBox = await disable.boundingBox();
  expect(disableBox?.y).toBe(resetBox?.y);
  await disable.click();
  await page
    .getByRole('alertdialog', { name: 'Отключить доступ?' })
    .getByRole('button', { name: 'Отключить', exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: /^Отключённые/ }).click();
  await row.getByRole('link', { name: STUDENT, exact: true }).click();
  await page.getByRole('tab', { name: 'Профиль' }).click();
  await expect(
    page.getByText('Доступ отключён. Вы можете вернуть его кнопкой ниже.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Вернуть доступ', exact: true }).click();
  await page.getByRole('button', { name: /^Все/ }).click();
  await expect(row).toBeVisible();
});
