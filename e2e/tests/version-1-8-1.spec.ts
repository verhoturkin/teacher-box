import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 1.8.1: call fixes — the own camera floats in a corner and moves, no tooltips on call buttons,
 * the settings menu opens above the call window with sound processing and «Сведения о связи». Runs on the
 * split variant only (ADR-0031): the signalling goes through the nginx of the frontend.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Лев Связной ${RUN}`;

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

async function signIn(page: Page, user: string, secret: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(user);
  await page.locator('#password').fill(secret);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function joinFromSheet(page: Page, title: string): Promise<void> {
  const sheet = page.getByRole('dialog', { name: `Звонок: ${title}` });
  await expect(sheet.locator('video')).toBeVisible();
  await sheet.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByText('Подключение к звонку…')).toBeHidden({ timeout: 30_000 });
}

test.beforeAll(async ({ request }) => {
  const created = await request.post('/api/teacher/students', {
    headers: await bearer(request),
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { invite } = (await created.json()) as { invite: { token: string } };
  login = `link${RUN}`;
  password = `pass-${RUN}-link`;
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login, password },
  });
  expect(accepted.ok()).toBe(true);
});

test('the call window: movable own camera, settings menu and details', async ({ browser }) => {
  const teacher = await (await browser.newContext()).newPage();
  await signIn(teacher, 'teacher', TEACHER_PASSWORD);
  await teacher
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Звонки' })
    .click();
  await teacher
    .getByRole('list', { name: 'Комнаты' })
    .getByRole('button', { name: `Войти в звонок: ${STUDENT}` })
    .click();
  await joinFromSheet(teacher, STUDENT);

  const student = await (await browser.newContext()).newPage();
  await signIn(student, login, password);
  await student
    .locator('tb-my-calls-card')
    .getByRole('button', { name: 'Войти в звонок: Урок' })
    .click();
  await joinFromSheet(student, 'Урок');

  // one to one: the own camera floats in the bottom right corner and moves with the arrow keys
  const window = teacher.getByRole('dialog', { name: STUDENT });
  await expect(window).toContainText('2 участника');
  const self = window.locator('tb-call-self');
  await expect(self).toHaveClass(/tb-call-self--bottom-right/);
  await self.focus();
  await teacher.keyboard.press('ArrowUp');
  await expect(self).toHaveClass(/tb-call-self--top-right/);

  // no tooltips on the call buttons
  await window.getByRole('button', { name: 'Микрофон' }).hover();
  await teacher.waitForTimeout(500);
  await expect(teacher.locator('.p-tooltip')).toHaveCount(0);

  // the settings menu lies above the window: sound processing switches and is remembered
  await window.getByRole('button', { name: 'Настройки звонка' }).click();
  const noise = teacher.getByRole('menuitem', { name: 'Шумоподавление' });
  await expect(noise).toBeVisible();
  await noise.click();
  await expect
    .poll(() => teacher.evaluate(() => localStorage.getItem('tb-call-audio')))
    .toContain('"noiseSuppression":false');

  await window.getByRole('button', { name: 'Настройки звонка' }).click();
  await teacher.getByRole('menuitem', { name: 'Сведения о связи' }).click();
  const details = teacher.getByRole('dialog', { name: 'Сведения о связи' });
  await expect(details).toContainText('Качество связи');
  await expect(details).toContainText(STUDENT);
  await expect(details).toContainText('Протокол', { timeout: 10_000 });
  await expect(details).toContainText('LiveKit');
  await details.getByRole('button', { name: 'Закрыть' }).last().click();
  await expect(details).toBeHidden();

  await student.getByRole('button', { name: 'Выйти из звонка' }).click();
  await teacher.getByRole('button', { name: 'Выйти из звонка' }).click();
  await expect(window).toBeHidden();
  await student.context().close();
  await teacher.context().close();
});
