import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.24.0, Today and Schedule: the «Нужно сделать» queue of Today holds a past lesson without a mark and
 * marks it in place; the schedule's calendar outlines a lesson until it is marked, and the outline disappears
 * once the lesson is marked. The queue shows only the first rows (the oldest lessons), so its lesson is a very old
 * one: other specs leave their own unmarked lessons on the instance.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const QUEUED = `Очередь ${RUN}`;
const OUTLINED = `Контур ${RUN}`;
const DAY = 86_400_000;
const WIDE = { width: 1440, height: 900 };

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize(WIDE);
  await page.goto('/login');
  await page.locator('#login').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function post<T>(
  request: APIRequestContext,
  headers: Record<string, string>,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(path, { headers, data });
  expect(response.ok(), `POST ${path}: ${String(response.status())}`).toBe(true);
  return (await response.json()) as T;
}

let outlinedLessonId = '';

async function lessonFor(
  request: APIRequestContext,
  headers: Record<string, string>,
  displayName: string,
  startsAt: Date,
): Promise<string> {
  const created = await post<{ student: { id: string } }>(
    request,
    headers,
    '/api/teacher/students',
    { displayName, email: null, phone: null, note: null },
  );
  const lesson = await post<{ id: string }>(request, headers, '/api/teacher/schedule/lessons', {
    studentId: created.student.id,
    startsAt: startsAt.toISOString(),
    durationMinutes: 30,
    allowOverlap: true,
  });
  return lesson.id;
}

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(login.ok()).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };
  await lessonFor(request, headers, QUEUED, new Date(Date.now() - 300 * DAY));
  outlinedLessonId = await lessonFor(
    request,
    headers,
    OUTLINED,
    new Date(Date.now() - 2 * 3_600_000),
  );
});

test('the queue marks a lesson in place', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher');
  const row = page.locator('ul.tb-queue li').filter({ hasText: QUEUED });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Проведено' }).click();
  await expect(row).toHaveCount(0);
});

test('the calendar outline disappears after the lesson is marked', async ({ page, request }) => {
  await signIn(page);
  await page.goto('/teacher/schedule');
  await page.getByRole('tab', { name: 'Вид: Месяц', exact: true }).click();
  const lesson = page.locator('.tb-lesson', { hasText: OUTLINED }).first();
  await expect(lesson).toBeVisible();
  await expect(lesson).toHaveClass(/tb-lesson--unmarked/);

  const login = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  const { accessToken } = (await login.json()) as { accessToken: string };
  const marked = await request.put(`/api/teacher/schedule/lessons/${outlinedLessonId}/outcome`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { outcome: 'CONDUCTED' },
  });
  expect(marked.ok()).toBe(true);

  await page.reload();
  await page.getByRole('tab', { name: 'Вид: Месяц', exact: true }).click();
  await expect(page.locator('.tb-lesson', { hasText: OUTLINED }).first()).toBeVisible();
  await expect(page.locator('.tb-lesson--unmarked', { hasText: OUTLINED })).toHaveCount(0);
});
