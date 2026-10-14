import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.11.0: the interface in English, chosen on the sign-in page and in the user menu under the
 * theme and kept on the device; a task put on an Excalidraw board as text stays there; a day picked in the
 * month view plans a lesson with the default duration, not of the whole day.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);

test.describe.configure({ mode: 'serial' });

async function teacher(request: APIRequestContext): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function signIn(page: Page, button: string): Promise<void> {
  await page.locator('#login').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: button }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('the interface speaks English and goes back to Russian', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: /^Sign in to/ })).toBeVisible();
  await signIn(page, 'Sign in');

  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Schedule' }).first()).toBeVisible();

  // kept on the device: a reload keeps English
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /user menu/ }).click();
  // 0.15.0: the chosen language is a checked radio item, without «(selected)»
  await expect(page.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('menuitemradio', { name: 'Русский' }).click();
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
});

test('a task put on a board as text stays on the board', async ({ page, request }) => {
  const headers = await teacher(request);
  const created = await request.post('/api/teacher/boards', {
    headers,
    data: { kind: 'EXCALIDRAW', title: `Текстом ${RUN}`, url: null, studentIds: [], groupIds: [] },
  });
  expect(created.ok()).toBe(true);
  const { id: boardId } = (await created.json()) as { id: string };

  await page.goto('/login');
  await signIn(page, 'Войти');
  // what «На доску» → «Текстом» leaves for the board opened in a new tab
  await page.evaluate(
    ({ id, title }) => {
      localStorage.setItem(
        `tb.board-insert.${id}`,
        JSON.stringify({ title, markdown: 'Решите задачи 1-3', mode: 'text', at: Date.now() }),
      );
    },
    { id: boardId, title: `Задание ${RUN}` },
  );
  await page.goto(`/teacher/boards/${boardId}`);
  await expect(page.locator('.excalidraw canvas.interactive')).toBeVisible({ timeout: 30_000 });

  await expect
    .poll(
      async () => {
        const board = await request.get(`/api/boards/${boardId}`, { headers });
        const { elements } = (await board.json()) as {
          elements: { type: string; text?: string; isDeleted?: boolean }[];
        };
        return elements
          .filter((element) => element.type === 'text' && !element.isDeleted)
          .map((element) => element.text ?? '');
      },
      { timeout: 20_000 },
    )
    .toEqual([`Задание ${RUN}\n\nРешите задачи 1-3`]);
});

test('a day of the month view plans a lesson of the default duration', async ({ page }) => {
  await page.goto('/login');
  await signIn(page, 'Войти');
  await page.goto('/teacher/schedule');
  // the lessons of the month first (buttons in their days): an empty day is picked among the days without them
  const lessons = page.waitForResponse(
    (response) => response.url().includes('/api/teacher/schedule/lessons') && response.ok(),
  );
  await page.getByRole('tab', { name: /Месяц/ }).click();
  await lessons;

  const day = page
    .locator('[data-date]')
    .filter({ hasNot: page.getByRole('button') })
    .nth(20);
  await day.click({ position: { x: 20, y: 40 } });

  const dialog = page.getByRole('dialog', { name: 'Новое занятие' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#schedule-lesson-start')).toHaveValue(/ 10:00$/);
  await expect(dialog.locator('#schedule-lesson-duration')).not.toHaveValue('1440');
  await expect(dialog.locator('#schedule-lesson-duration')).not.toHaveValue('1 440');
});
