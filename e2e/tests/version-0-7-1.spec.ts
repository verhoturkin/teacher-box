import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.7.1: «Доски» has no member filter; the board's «Резервные копии» are only in its menu; a shape
 * added to the library stays there after a reload and is the teacher's alone.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const BOARD = `Библиотека ${RUN}`;

test.describe.configure({ mode: 'serial' });

let boardId: string;

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function teacher(request: APIRequestContext): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function editorReady(page: Page): Promise<void> {
  await expect(page.locator('.excalidraw canvas.interactive')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Сохранено' })).toBeVisible();
}

test.beforeAll(async ({ request }) => {
  const headers = await teacher(request);
  await request.put('/api/boards/library', { headers, data: [] });
  const created = await request.post('/api/teacher/boards', {
    headers,
    data: { kind: 'EXCALIDRAW', title: BOARD, url: null, studentIds: [], groupIds: [] },
  });
  expect(created.ok()).toBe(true);
  boardId = ((await created.json()) as { id: string }).id;
});

test('«Доски» lists every board without a member filter', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/boards');

  await expect(page.getByRole('listitem').filter({ hasText: BOARD })).toBeVisible();
  await expect(page.getByLabel('Ученик или группа')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Все доски' })).toHaveCount(0);
});

test('a shape added to the library stays there after a reload', async ({ page }) => {
  await signIn(page);
  await page.goto(`/teacher/boards/${boardId}`);
  await editorReady(page);
  await expect(page.locator('.tb-board-page__bar')).not.toContainText('Резервные копии');

  await page
    .locator('.excalidraw .App-toolbar')
    .getByTitle(/^Эллипс/)
    .click();
  const box = await page.locator('.excalidraw canvas.interactive').boundingBox();
  if (box === null) throw new Error('No canvas');
  const left = box.x + box.width * 0.4;
  const top = box.y + box.height * 0.4;
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move(left + 100, top + 60, { steps: 5 });
  await page.mouse.up();

  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().endsWith('/api/boards/library') &&
      response.status() === 200,
  );
  await page.mouse.click(left + 100, top + 30, { button: 'right' });
  await page.getByText('Добавить в библиотеку').click();
  await saved;

  await page.reload();
  await editorReady(page);
  await page.locator('.excalidraw .default-sidebar-trigger').click();
  await expect(page.locator('.excalidraw .library-unit')).toHaveCount(1);
  await expect(page.locator('.excalidraw .library-menu-browse-button')).toBeHidden();

  const library = await page.request.get('/api/boards/library', {
    headers: await teacher(page.request),
  });
  expect(((await library.json()) as unknown[]).length).toBe(1);
});
