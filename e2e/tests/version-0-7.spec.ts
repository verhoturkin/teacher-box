import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.7: our own Excalidraw boards (ADR-0028). The teacher creates a board for a student and a
 * group, draws and returns to «Доски»; the student opens it from «Мои доски» and sees the drawing; both
 * edit at once and see each other's shapes within a poll; the teacher makes a copy, changes the board
 * and restores it; an external board opens in a new tab.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const VERA = `Вера ${RUN}`;
const GROUP = `Доски ${RUN}`;
const BOARD = `Дроби ${RUN}`;

interface Account {
  readonly id: string;
  readonly login: string;
  readonly password: string;
}

interface Scene {
  readonly sceneVersion: number;
  readonly elements: readonly { readonly id: string; readonly isDeleted: boolean }[];
}

test.describe.configure({ mode: 'serial' });

let vera: Account;
let groupId: string;
let boardId: string;

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

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

function teacher(request: APIRequestContext): Promise<Record<string, string>> {
  return bearer(request, 'teacher', TEACHER_PASSWORD);
}

/** A student who accepted the invitation. */
async function student(request: APIRequestContext, name: string): Promise<Account> {
  const created = await request.post('/api/teacher/students', {
    headers: await teacher(request),
    data: { displayName: name, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student: added, invite } = (await created.json()) as {
    student: { id: string };
    invite: { token: string };
  };
  const login = `b${RUN}${String(Math.random()).slice(2, 6)}`;
  const password = `pass-${RUN}-boards`;
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login, password },
  });
  expect(accepted.ok()).toBe(true);
  return { id: added.id, login, password };
}

async function scene(request: APIRequestContext, account?: Account): Promise<Scene> {
  const headers = account
    ? await bearer(request, account.login, account.password)
    : await teacher(request);
  const response = await request.get(`/api/boards/${boardId}`, { headers });
  expect(response.ok()).toBe(true);
  return (await response.json()) as Scene;
}

/** The board editor of the page is loaded and saved. */
async function editorReady(page: Page): Promise<void> {
  await expect(page.locator('.excalidraw canvas.interactive')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Сохранено' })).toBeVisible();
}

/**
 * Draws a shape with a tool of Excalidraw's toolbar, `x` and `y` — a share of the canvas (the left
 * edge holds the shape properties), and waits until the board is saved.
 */
async function draw(
  page: Page,
  tool: 'Прямоугольник' | 'Эллипс',
  x: number,
  y: number,
): Promise<void> {
  await page
    .locator('.excalidraw .App-toolbar')
    .getByTitle(new RegExp(`^${tool}`))
    .click();
  const box = await page.locator('.excalidraw canvas.interactive').boundingBox();
  if (box === null) throw new Error('No canvas');
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().endsWith('/scene') &&
      response.status() === 200,
    { timeout: 15_000 },
  );
  const left = box.x + box.width * x;
  const top = box.y + box.height * y;
  await page.mouse.move(left, top);
  await page.mouse.down();
  await page.mouse.move(left + 50, top + 30, { steps: 5 });
  await page.mouse.move(left + 100, top + 60, { steps: 5 });
  await page.mouse.up();
  await saved;
}

/** «Резервные копии» of the board menu (☰). */
async function openCopies(page: Page): Promise<void> {
  await page.locator('.excalidraw .main-menu-trigger').click();
  await page
    .locator('.excalidraw .dropdown-menu-item')
    .filter({ hasText: 'Резервные копии' })
    .click();
}

test.beforeAll(async ({ request }) => {
  vera = await student(request, VERA);
  const other = await student(request, `Гриша ${RUN}`);
  const group = await request.post('/api/teacher/groups', {
    headers: await teacher(request),
    data: { name: GROUP, memberIds: [other.id] },
  });
  expect(group.ok()).toBe(true);
  groupId = ((await group.json()) as { id: string }).id;
});

test('the teacher creates a board for a student and a group, draws and returns', async ({
  page,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/boards');
  await page.getByRole('button', { name: 'Новая доска' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая доска' });
  await page.locator('#board-title').fill(BOARD);
  await page.locator('p-multiselect:has(#board-students)').click();
  await page.getByRole('option', { name: VERA }).click();
  await page.keyboard.press('Escape');
  await page.locator('p-multiselect:has(#board-groups)').click();
  await page.getByRole('option', { name: GROUP }).click();
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Создать' }).click();

  const row = page.getByRole('row', { name: new RegExp(BOARD) });
  await expect(row).toContainText('Доска Excalidraw');
  await expect(row).toContainText(VERA);
  await expect(row).toContainText(`группа «${GROUP}»`);
  const link = row.getByRole('link', { name: BOARD });
  boardId = ((await link.getAttribute('href')) ?? '').split('/').pop() ?? '';
  await link.click();

  await expect(page).toHaveURL(new RegExp(`/teacher/boards/${boardId}$`));
  await expect(page.getByRole('navigation', { name: 'Разделы' })).toHaveCount(0);
  await editorReady(page);
  await draw(page, 'Прямоугольник', 0.4, 0.3);
  await expect(page.getByRole('status').filter({ hasText: 'Сохранено' })).toBeVisible();

  await page.getByRole('link', { name: 'Доски' }).click();
  await expect(page).toHaveURL(/\/teacher\/boards$/);
  await expect.poll(async () => (await scene(page.request)).elements.length).toBe(1);
});

test('the student opens the board from «Мои доски» and sees the drawing', async ({
  page,
  request,
}) => {
  await signIn(page, vera.login, vera.password);
  await page.getByRole('link', { name: 'Мои доски' }).first().click();
  await expect(page).toHaveURL(/\/cabinet\/boards$/);
  await page.getByRole('link', { name: BOARD }).click();

  await expect(page).toHaveURL(new RegExp(`/cabinet/boards/${boardId}$`));
  await editorReady(page);
  await expect(page.getByRole('link', { name: 'Мои доски' })).toBeVisible();
  expect((await scene(request, vera)).elements).toHaveLength(1);
});

test('the teacher and the student edit at once and see each other’s shapes', async ({
  page,
  browser,
  request,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto(`/teacher/boards/${boardId}`);
  await editorReady(page);
  const pupil = await (await browser.newContext({ locale: 'ru-RU' })).newPage();
  await signIn(pupil, vera.login, vera.password);
  await pupil.goto(`/cabinet/boards/${boardId}`);
  await editorReady(pupil);

  const before = (await scene(request)).sceneVersion;
  const teacherSees = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/boards/${boardId}/scene?since=`) && response.status() === 200,
    { timeout: 20_000 },
  );
  await draw(pupil, 'Эллипс', 0.6, 0.5);
  await teacherSees;

  const pupilSees = pupil.waitForResponse(
    (response) =>
      response.url().includes(`/api/boards/${boardId}/scene?since=`) && response.status() === 200,
    { timeout: 20_000 },
  );
  await draw(page, 'Прямоугольник', 0.7, 0.2);
  await pupilSees;

  const after = await scene(request);
  expect(after.sceneVersion).toBeGreaterThan(before);
  expect(after.elements.filter((element) => !element.isDeleted)).toHaveLength(3);
});

test('the teacher makes a copy, changes the board and restores it', async ({ page, request }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto(`/teacher/boards/${boardId}`);
  await editorReady(page);
  await openCopies(page);
  const copies = page.getByRole('dialog', { name: /Резервные копии/ });
  await copies.getByRole('button', { name: 'Сделать копию' }).click();
  await expect(copies).toContainText('Копия учителя');
  await page.keyboard.press('Escape');
  await expect(copies).toBeHidden();

  await draw(page, 'Прямоугольник', 0.45, 0.7);
  await expect
    .poll(
      async () => (await scene(request)).elements.filter((element) => !element.isDeleted).length,
    )
    .toBe(4);

  await openCopies(page);
  await copies
    .getByRole('button', { name: /^Восстановить копию от/ })
    .last()
    .click();
  await expect(copies).toContainText('Текущий рисунок сохранится копией');
  await copies.locator('.p-message').getByRole('button', { name: 'Восстановить' }).click();
  await expect(copies.getByText('Копия учителя')).toHaveCount(2);

  await expect
    .poll(
      async () => (await scene(request)).elements.filter((element) => !element.isDeleted).length,
    )
    .toBe(3);
});

test('an external board opens in a new tab', async ({ page, request }) => {
  const created = await request.post('/api/teacher/boards', {
    headers: await teacher(request),
    data: {
      kind: 'LINK',
      title: `Холст ${RUN}`,
      url: 'https://app.holst.so/board/e2e-1-7',
      studentIds: [],
      groupIds: [groupId],
    },
  });
  expect(created.ok()).toBe(true);

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto(`/teacher/boards?group=${groupId}`);
  const link = page.getByRole('link', { name: `Холст ${RUN}` });
  await expect(link).toHaveAttribute('href', 'https://app.holst.so/board/e2e-1-7');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('row', { name: new RegExp(`Холст ${RUN}`) })).toContainText(
    'Внешняя доска',
  );
});
