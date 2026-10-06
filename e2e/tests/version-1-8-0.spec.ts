import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 1.8.0: built-in calls on LiveKit (ADR-0030) — the teacher sees the room of a student on
 * «Звонки», joins it, minimizes the call and keeps working in the portal; the student joins from the
 * card on the home page and both see each other; the room's status follows. The browser has a fake
 * camera and microphone (playwright.config.ts).
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Вера Звонкова ${RUN}`;

test.describe.configure({ mode: 'serial' });

interface Account {
  readonly id: string;
  readonly login: string;
  readonly password: string;
}

let vera: Account;

async function bearer(
  request: APIRequestContext,
  login: string,
  password: string,
): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Joins from the pre-join sheet with the fake camera and microphone. */
async function joinFromSheet(page: Page, title: string): Promise<void> {
  const sheet = page.getByRole('dialog', { name: `Звонок: ${title}` });
  await expect(sheet.locator('video')).toBeVisible();
  await sheet.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('dialog', { name: title })).toBeVisible();
  await expect(page.getByText('Подключение к звонку…')).toBeHidden({ timeout: 30_000 });
}

test.beforeAll(async ({ request }) => {
  const created = await request.post('/api/teacher/students', {
    headers: await bearer(request, 'teacher', TEACHER_PASSWORD),
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student, invite } = (await created.json()) as {
    student: { id: string };
    invite: { token: string };
  };
  const login = `call${RUN}`;
  const password = `pass-${RUN}-calls`;
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login, password },
  });
  expect(accepted.ok()).toBe(true);
  vera = { id: student.id, login, password };
});

test('the teacher and the student meet in the room of the student', async ({ browser }) => {
  const teacher = await (await browser.newContext()).newPage();
  await signIn(teacher, 'teacher', TEACHER_PASSWORD);
  await teacher
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Звонки' })
    .click();
  const rooms = teacher.getByRole('list', { name: 'Комнаты' });
  const card = rooms.getByRole('listitem').filter({ hasText: STUDENT });
  await expect(card).toContainText('Пусто');

  await card.getByRole('button', { name: `Войти в звонок: ${STUDENT}` }).click();
  await joinFromSheet(teacher, STUDENT);
  await expect(teacher.getByText('Пока в комнате только вы')).toBeVisible();
  await expect(teacher.getByRole('button', { name: 'Микрофон' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // minimized, the call goes on while the teacher works in the portal
  await teacher.getByRole('button', { name: 'Свернуть' }).click();
  const mini = teacher.getByRole('region', { name: 'Звонок' });
  await expect(mini).toContainText(STUDENT);
  await teacher
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Расписание' })
    .click();
  await expect(teacher).toHaveURL(/\/teacher\/schedule/);
  await expect(mini).toBeVisible();

  const student = await (await browser.newContext()).newPage();
  await signIn(student, vera.login, vera.password);
  const calls = student.locator('tb-my-calls-card');
  await expect(calls).toContainText('Учитель уже в звонке');
  await calls.getByRole('button', { name: 'Войти в звонок: Урок' }).click();
  await joinFromSheet(student, 'Урок');
  // the teacher on the stage, the student in the inset
  await expect(student.locator('tb-call-tile')).toHaveCount(2);

  // the teacher sees the student come in, with her camera
  await mini.getByRole('button', { name: 'Развернуть' }).click();
  const window = teacher.getByRole('dialog', { name: STUDENT });
  await expect(window).toContainText('2 участника');
  await expect(
    window.locator('tb-call-tile').filter({ hasText: STUDENT }).locator('video'),
  ).toBeVisible();

  await student.getByRole('button', { name: 'Выйти из звонка' }).click();
  await expect(student.getByRole('dialog', { name: 'Урок' })).toBeHidden();
  await expect(window).toContainText('1 участник', { timeout: 20_000 });
  await teacher.getByRole('button', { name: 'Выйти из звонка' }).click();
  await expect(window).toBeHidden();

  await student.context().close();
  await teacher.context().close();
});

test('a lesson link of the built-in room opens the call in the portal', async ({
  page,
  request,
}) => {
  const headers = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const rooms = await request.get('/api/teacher/meetings/calls', { headers });
  expect(((await rooms.json()) as { status: string }).status).toBe('OK');

  await signIn(page, vera.login, vera.password);
  await page.goto(`/call/${vera.id}`);

  await expect(page).toHaveURL(/\/cabinet$/);
  await expect(page.getByRole('dialog', { name: 'Звонок: Урок' })).toBeVisible();
  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(page.getByRole('dialog', { name: 'Звонок: Урок' })).toBeHidden();
});
