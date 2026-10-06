import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.7.2: a board in real time — two editors see each other and the strokes come over the live
 * channel (WebSocket); the board menu has the theme, the grid and the mouse wheel; the editor takes the
 * portal's colours.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const BOARD = `Вместе ${RUN}`;

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

async function openMenu(page: Page): Promise<void> {
  await page.locator('.excalidraw .main-menu-trigger').click();
}

function menuItem(page: Page, name: string) {
  return page.locator('.excalidraw .dropdown-menu-item').filter({ hasText: name });
}

test.beforeAll(async ({ request }) => {
  const created = await request.post('/api/teacher/boards', {
    headers: await teacher(request),
    data: { kind: 'EXCALIDRAW', title: BOARD, url: null, studentIds: [], groupIds: [] },
  });
  expect(created.ok()).toBe(true);
  boardId = ((await created.json()) as { id: string }).id;
});

test('two editors of a board see each other and the strokes at once', async ({ browser }) => {
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  await signIn(first);
  await signIn(second);

  await first.goto(`/teacher/boards/${boardId}`);
  await editorReady(first);
  const strokes = new Promise<void>((resolve) => {
    second.on('websocket', (socket) => {
      socket.on('framereceived', ({ payload }) => {
        if (typeof payload === 'string' && payload.includes('"type":"elements"')) resolve();
      });
    });
  });
  await second.goto(`/teacher/boards/${boardId}`);
  await editorReady(second);
  await expect(first.locator('.excalidraw .UserList')).toBeVisible();

  await first
    .locator('.excalidraw .App-toolbar')
    .getByTitle(/^Прямоугольник/)
    .click();
  const box = await first.locator('.excalidraw canvas.interactive').boundingBox();
  if (box === null) throw new Error('No canvas');
  await first.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await first.mouse.down();
  await first.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 5 });
  await first.mouse.up();

  await strokes;
  await expect(second.getByRole('status').filter({ hasText: 'Сохранено' })).toBeVisible();
  await first.context().close();
  await second.context().close();
});

test('the board menu switches the theme, the grid and the wheel; the editor has portal colours', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/teacher/boards/${boardId}`);
  await editorReady(page);

  const colours = await page.evaluate(() => {
    const editor = document.querySelector('.excalidraw');
    return editor === null
      ? null
      : [
          getComputedStyle(editor).getPropertyValue('--color-primary').trim(),
          getComputedStyle(document.documentElement).getPropertyValue('--p-md-primary').trim(),
        ];
  });
  expect(colours?.[0]).toBe(colours?.[1]);

  await openMenu(page);
  await menuItem(page, 'Тёмная').click();
  await expect(page.locator('html')).toHaveClass(/tb-dark/);
  await expect(page.locator('.excalidraw.theme--dark')).toBeVisible();

  await openMenu(page);
  await expect(menuItem(page, 'Сетка')).toHaveAttribute('aria-checked', 'false');
  await menuItem(page, 'Сетка').click();
  await openMenu(page);
  await expect(menuItem(page, 'Сетка')).toHaveAttribute('aria-checked', 'true');
  await expect(menuItem(page, 'Масштаб')).toHaveAttribute('aria-checked', 'true');
  await menuItem(page, 'Прокрутка (тачпад)').click();
  await openMenu(page);
  await expect(menuItem(page, 'Прокрутка (тачпад)')).toHaveAttribute('aria-checked', 'true');

  await menuItem(page, 'Как в системе').click();
  await expect(page.locator('html')).not.toHaveClass(/tb-dark/);
});
