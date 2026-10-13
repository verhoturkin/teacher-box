import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.15.2: the bell opens the notifications when its badge is pressed; on a phone the lists of things (tasks,
 * boards, textbooks…) have no icon at the start of their rows, on a computer they keep it.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик списков ${RUN}`;
const LOGIN = `lists-${RUN}`;
const PASSWORD = `lists-pass-${RUN}`;
const HOMEWORK = `Домашнее ${RUN}`;

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
  method: 'POST',
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${method} ${path}: ${String(response.status())}`).toBe(true);
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

async function signIn(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.locator('#login').fill(LOGIN);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/cabinet$/);
}

test.beforeAll(async ({ request }) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const created = await api<{ student: { id: string }; invite: { token: string } }>(
    request,
    teacher,
    'POST',
    '/api/teacher/students',
    { displayName: STUDENT, email: null, phone: null, note: null },
  );
  await api(request, teacher, 'POST', `/api/auth/invites/${created.invite.token}/accept`, {
    login: LOGIN,
    password: PASSWORD,
  });
  // a new task: a row in «Задания» and an unread notification on the bell
  await api(request, teacher, 'POST', '/api/teacher/homework/assignments', {
    title: HOMEWORK,
    description: 'Упражнения',
    studentIds: [created.student.id],
  });
});

test('pressing the badge of the bell opens the notifications', async ({ page }) => {
  await signIn(page, 1280);
  const badge = page.locator('tb-notification-bell .p-badge');
  // the notification of the task comes from an event: wait for it with a reload
  await expect(async () => {
    await page.reload();
    await expect(badge).toBeVisible({ timeout: 2_000 });
  }).toPass();
  // a click on the badge's spot, as a finger does (the badge itself lets the pointer through)
  const box = await badge.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(
    (box?.x ?? 0) + (box?.width ?? 0) / 2,
    (box?.y ?? 0) + (box?.height ?? 0) / 2,
  );
  await expect(page).toHaveURL(/\/cabinet\/notifications$/);
});

test('on a phone the tasks have no icon at the start, on a computer they do', async ({ page }) => {
  await signIn(page, 390);
  await page.goto('/cabinet/homework');
  const row = page.locator('li', { has: page.getByRole('link', { name: HOMEWORK }) });
  await expect(row).toBeVisible();
  await expect(row.locator('.tb-list__lead')).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(row.locator('.tb-list__lead')).toBeVisible();
});
