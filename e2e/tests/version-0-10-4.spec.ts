import { type APIRequestContext, expect, test } from '@playwright/test';

/**
 * Version 0.10.4: the images saved on a board are asked for right when it opens, not after the first
 * poll of the scene (5 s, 30 s with the live channel) or a stroke.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const IMAGES = 3;
/** Well below the poll interval that used to bring the images. */
const SOON_MS = 3_000;
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
    x: 120 * index + 40,
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
    data: {
      kind: 'EXCALIDRAW',
      title: `Картинки сразу ${RUN}`,
      url: null,
      studentIds: [],
      groupIds: [],
    },
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

test('a board asks for its images as soon as it opens', async ({ page }) => {
  const requested = new Set<string>();
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes(`/api/boards/${boardId}/files/`))
      requested.add(request.url());
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto(`/teacher/boards/${boardId}`);
  await expect(page.locator('.excalidraw canvas.interactive')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => requested.size, { timeout: SOON_MS }).toBe(IMAGES);
});
