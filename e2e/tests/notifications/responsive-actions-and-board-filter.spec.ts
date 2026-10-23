import { startSession } from '../support/session';
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
  await startSession(page, login, password);
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

test('the teacher filters the boards by the chips and one search', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  // 0.26.0: the boards are a tab of «Материалы»: cards, chips «На портале» / «Внешние», one search
  await page.goto('/teacher/boards');
  const feed = page.locator('tb-boards-feed');
  const search = page.getByRole('searchbox', { name: 'Название, ученик или группа' });

  await search.fill(STUDENT);
  await expect(feed.getByRole('listitem').filter({ hasText: BOARD })).toHaveCount(1);
  await search.fill('');

  await page.getByRole('button', { name: 'Внешние' }).click();
  await expect(feed).toContainText(LINK_BOARD);
  await expect(feed).not.toContainText(BOARD);

  await search.fill(`нет такой ${RUN}`);
  await expect(feed.getByText('Ничего не найдено')).toBeVisible();
});
