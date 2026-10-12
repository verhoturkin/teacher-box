import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.14.1: homework has no kinds again. The editor gives an assignment to the students of chosen groups with
 * the due date at their next lesson, «Выдать и поместить на доску» puts it on their board and remembers it — the
 * student's task leads to that board; the list of assignments is made of cards.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const LIZA = `Лиза ${RUN}`;
const LIZA_LOGIN = `liza-${RUN}`;
const LIZA_PASSWORD = `pass-${RUN}-liza`;
const GROUP = `Группа ${RUN}`;
const BOARD = `Доска ${RUN}`;
const TITLE = `Схема ${RUN}`;

async function bearer(
  request: APIRequestContext,
  login: string,
  password: string,
): Promise<string> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

async function api<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(path, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `POST ${path}: ${String(response.status())}`).toBe(true);
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('an assignment for a group goes on its board and the student is led there', async ({
  page,
  browser,
  request,
}) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const created = await api<{ student: { id: string }; invite: { token: string } }>(
    request,
    teacher,
    '/api/teacher/students',
    { displayName: LIZA },
  );
  const lizaId = created.student.id;
  await api(request, teacher, `/api/auth/invites/${created.invite.token}/accept`, {
    login: LIZA_LOGIN,
    password: LIZA_PASSWORD,
  });
  await api(request, teacher, '/api/teacher/groups', { name: GROUP, memberIds: [lizaId] });
  const board = await api<{ id: string }>(request, teacher, '/api/teacher/boards', {
    kind: 'EXCALIDRAW',
    title: BOARD,
    url: null,
    studentIds: [lizaId],
    groupIds: [],
  });
  // 17:30 in the browser's time zone (Europe/Moscow, UTC+3, playwright.config.ts) the day after tomorrow
  const lesson = new Date();
  lesson.setUTCDate(lesson.getUTCDate() + 2);
  lesson.setUTCHours(14, 30, 0, 0);
  await api(request, teacher, '/api/teacher/schedule/lessons', {
    studentId: lizaId,
    startsAt: lesson.toISOString(),
    durationMinutes: 60,
    allowOverlap: true,
  });

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework/new');
  await expect(page.getByText('Тип задания')).toHaveCount(0);
  await page.locator('#editor-title').fill(TITLE);
  await page.locator('#editor-text').fill('Нарисуйте **схему** круговорота воды');
  await page.getByRole('button', { name: 'Просмотр', exact: true }).click();
  await expect(page.locator('.tb-preview strong')).toHaveText('схему');
  await expect(page.locator('#editor-text')).toHaveCount(0);

  // PrimeNG puts the id on a hidden input; the component itself opens the list.
  await page.locator('p-multiselect:has(#editor-group)').click();
  await page.getByRole('option', { name: GROUP }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('p-multiselect:has(#editor-students)')).toContainText(LIZA);
  const day = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow' }).format(lesson);
  await expect(page.locator('#editor-due')).toHaveValue(`${day} 17:30`);

  await page
    .locator('tb-page-header')
    .getByRole('button', { name: 'Выдать и поместить на доску' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'На доску' });
  await expect(dialog).toContainText(BOARD);
  const opened = page.waitForEvent('popup');
  await dialog.getByRole('button', { name: 'Текстом' }).click();
  const tab = await opened;
  await expect(tab).toHaveURL(new RegExp(`/teacher/boards/${board.id}$`));
  await tab.close();
  await dialog.getByRole('button', { name: 'Закрыть' }).last().click();

  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
  await expect(
    page.locator('tb-page-header').getByRole('link', { name: 'Открыть доску' }),
  ).toHaveAttribute('href', `/teacher/boards/${board.id}`);

  await page.goto('/teacher/homework');
  const card = page.locator('ul.tb-list > li').filter({ hasText: TITLE });
  await expect(card).toContainText(LIZA);
  await expect(card).toContainText('Выдано');
  await expect(card.getByRole('button', { name: `Действия: ${TITLE}` })).toBeVisible();

  const context = await browser.newContext();
  const student = await context.newPage();
  await signIn(student, LIZA_LOGIN, LIZA_PASSWORD);
  await student.goto('/cabinet/homework');
  await student.getByRole('link', { name: TITLE }).click();
  await expect(student.getByRole('link', { name: 'Перейти на доску' })).toHaveAttribute(
    'href',
    `/cabinet/boards/${board.id}`,
  );
  await expect(student.locator('#answer-text')).toBeVisible();
  await context.close();
});
