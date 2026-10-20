import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.24.0, Today and Schedule: the «Нужно сделать» queue of Today holds a past lesson without a mark and
 * marks it in place; the schedule's calendar outlines the same lesson until it is marked, and the outline
 * disappears once the lesson is marked.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const QUEUED = `Очередь ${RUN}`;
const OUTLINED = `Контур ${RUN}`;
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

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(login.ok()).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };
  for (const name of [QUEUED, OUTLINED]) {
    const created = await post<{ student: { id: string } }>(
      request,
      headers,
      '/api/teacher/students',
      { displayName: name, email: null, phone: null, note: null },
    );
    await post(request, headers, '/api/teacher/schedule/lessons', {
      studentId: created.student.id,
      startsAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      durationMinutes: 30,
      allowOverlap: true,
    });
  }
});

test('the queue marks a lesson in place', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher');
  const row = page.locator('ul.tb-queue li').filter({ hasText: QUEUED });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Проведено' }).click();
  await expect(row).toHaveCount(0);
});

test('the calendar outline disappears after the lesson is marked', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/schedule');
  const event = page.locator('.fc-event', { hasText: OUTLINED });
  await expect(event.first()).toBeVisible();
  await expect(event.first()).toHaveClass(/tb-lesson--unmarked/);
  // the other lesson was marked from the queue: no outline
  await expect(page.locator('.fc-event', { hasText: QUEUED }).first()).not.toHaveClass(
    /tb-lesson--unmarked/,
  );

  await page.goto('/teacher');
  await page
    .locator('ul.tb-queue li')
    .filter({ hasText: OUTLINED })
    .getByRole('button', { name: 'Проведено' })
    .click();
  await expect(page.locator('ul.tb-queue li').filter({ hasText: OUTLINED })).toHaveCount(0);

  await page.goto('/teacher/schedule');
  await expect(page.locator('.fc-event', { hasText: OUTLINED }).first()).toBeVisible();
  await expect(page.locator('.fc-event.tb-lesson--unmarked', { hasText: OUTLINED })).toHaveCount(0);
});
