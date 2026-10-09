import { type APIRequestContext, type Request, expect, test } from '@playwright/test';

/**
 * Version 0.10.3: the images saved on a board are fetched several at a time when it opens, each one
 * once, instead of one after another.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const IMAGES = 8;
/** A 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let boardId: string;

async function teacher(request: APIRequestContext): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

function image(index: number): Record<string, unknown> {
  return {
    id: `img-${RUN}-${String(index)}`,
    type: 'image',
    x: 120 * index,
    y: 100,
    width: 100,
    height: 100,
    angle: 0,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: `a${String(index)}`,
    roundness: null,
    seed: index + 1,
    version: 1,
    versionNonce: index + 1,
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    status: 'saved',
    fileId: `file-${RUN}-${String(index)}`,
    scale: [1, 1],
    crop: null,
  };
}

test.beforeAll(async ({ request }) => {
  const headers = await teacher(request);
  const created = await request.post('/api/teacher/boards', {
    headers,
    data: { kind: 'EXCALIDRAW', title: `Картинки ${RUN}`, url: null, studentIds: [], groupIds: [] },
  });
  expect(created.ok()).toBe(true);
  ({ id: boardId } = (await created.json()) as { id: string });

  const elements = Array.from({ length: IMAGES }, (_, index) => image(index));
  for (const element of elements) {
    const uploaded = await request.put(
      `/api/boards/${boardId}/files/${String(element['fileId'])}`,
      { headers: { ...headers, 'Content-Type': 'image/png' }, data: PNG },
    );
    expect(uploaded.ok()).toBe(true);
  }
  const saved = await request.put(`/api/boards/${boardId}/scene`, {
    headers,
    data: { elements, appState: {}, baseVersion: 0 },
  });
  expect(saved.ok()).toBe(true);
});

test('a board fetches its images several at a time, each once', async ({ page }) => {
  const isImage = (request: Request): boolean =>
    request.method() === 'GET' && request.url().includes(`/api/boards/${boardId}/files/`);
  const requested: string[] = [];
  let inFlight = 0;
  let mostInFlight = 0;
  page.on('request', (request) => {
    if (!isImage(request)) return;
    requested.push(request.url());
    inFlight++;
    mostInFlight = Math.max(mostInFlight, inFlight);
  });
  const done = (request: Request): void => {
    if (isImage(request)) inFlight--;
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto(`/teacher/boards/${boardId}`);
  await expect(page.locator('.excalidraw canvas.interactive')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => requested.length).toBe(IMAGES);
  expect(new Set(requested).size).toBe(IMAGES);
  expect(mostInFlight).toBeGreaterThan(1);
});
