import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.15.4: on a phone a notification has no «Отметить прочитанным» tick (a swipe reads it), on a computer it
 * keeps it; the teacher's boards are searched inside each card, as the assignments.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик 0.15.4 ${RUN}`;
const LOGIN = `tick-${RUN}`;
const PASSWORD = `tick-pass-${RUN}`;
const BOARD = `Доска 0.15.4 ${RUN}`;
const LINK_BOARD = `Холст 0.15.4 ${RUN}`;
const HOMEWORK = `Задание 0.15.4 ${RUN}`;

test.describe.configure({ mode: 'serial' });

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

async function signIn(page: Page, login: string, password: string, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.beforeAll(async ({ request }) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const created = await api<{ student: { id: string }; invite: { token: string } }>(
    request,
    teacher,
    '/api/teacher/students',
    { displayName: STUDENT, email: null, phone: null, note: null },
  );
  await api(request, teacher, `/api/auth/invites/${created.invite.token}/accept`, {
    login: LOGIN,
    password: PASSWORD,
  });
  for (const board of [
    { kind: 'EXCALIDRAW', title: BOARD, url: null },
    { kind: 'LINK', title: LINK_BOARD, url: 'https://app.holst.so/board/e2e-0-15-4' },
  ]) {
    await api(request, teacher, '/api/teacher/boards', {
      ...board,
      studentIds: [created.student.id],
      groupIds: [],
    });
  }
  // a new task: an unread notification of the student
  await api(request, teacher, '/api/teacher/homework/assignments', {
    title: HOMEWORK,
    description: 'Упражнения',
    studentIds: [created.student.id],
  });
});

test('a notification has no tick on a phone, keeps it on a computer', async ({ page }) => {
  await signIn(page, LOGIN, PASSWORD, 390);
  const row = page.locator('ul[aria-label="Непрочитанные"] > li').filter({ hasText: HOMEWORK });
  // the notification of the task comes from an event: wait for it, opening the bell's sheet again (0.22.0)
  await expect(async () => {
    await page.goto('/cabinet/notifications');
    await expect(row).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expect(row.getByRole('button', { name: 'Отметить прочитанным' })).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(row.getByRole('button', { name: 'Отметить прочитанным' })).toBeVisible();
});

test('the teacher searches the boards inside each card', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/boards');
  const portal = page.getByRole('list', { name: 'Доски на портале' });
  const external = page.getByRole('list', { name: 'Внешние доски' });

  await page.getByRole('searchbox', { name: 'Поиск: Доски на портале' }).fill(STUDENT);
  await expect(portal.getByRole('listitem')).toHaveCount(1);
  await expect(portal).toContainText(BOARD);
  // the other card keeps its own list
  await expect(external).toContainText(LINK_BOARD);

  await page.getByRole('searchbox', { name: 'Поиск: Внешние доски' }).fill(`нет такой ${RUN}`);
  await expect(page.getByText('Ничего не найдено')).toBeVisible();
  await expect(portal).toContainText(BOARD);
});
