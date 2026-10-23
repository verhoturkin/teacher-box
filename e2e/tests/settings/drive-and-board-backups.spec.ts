import { startSession, bearer as teacher } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { inflateRawSync } from 'node:zlib';

/**
 * Version 0.12.0: copies of the backups in the teacher's Google Drive (the setup and the return from
 * Google; Google itself is not reachable from the tests) and the portal backup keeps only the current
 * version of each board.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page): Promise<void> {
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

/** One entry of a zip archive (stored or deflated), found through the central directory. */
function zipEntry(zip: Buffer, name: string): string {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = zip.readUInt32LE(end + 16);
  const count = zip.readUInt16LE(end + 10);
  for (let index = 0; index < count; index++) {
    const method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    if (zip.toString('utf8', offset + 46, offset + 46 + nameLength) === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`No ${name} in the archive`);
}

test('the teacher sets up Google Drive for the backups', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/settings?open=data');
  const drive = page.locator('#drive');
  await expect(drive.getByText(/«Library».*Google Drive API/)).toBeVisible();
  await expect(drive.getByText(/«Publish app»/)).toBeVisible();
  await expect(drive.getByText('/api/public/backups/google/callback')).toBeVisible();

  await drive.locator('#drive-client-id').fill('e2e-client.apps.googleusercontent.com');
  await drive.locator('#drive-client-secret').fill('e2e-client-secret');
  await drive.getByRole('button', { name: 'Сохранить' }).click();
  await expect(drive.getByRole('button', { name: 'Подключить Google Диск' })).toBeVisible();

  await page.goto('/api/public/backups/google/callback?state=stale&code=x');
  // the settings open the category of the data (0.24.0): the address may already be the category's
  await expect(page).toHaveURL(/\/teacher\/settings(\/data)?\?drive=expired/);
  await expect(page.locator('#drive').getByText('Ссылка подключения устарела')).toBeVisible();
});

test('the portal backup keeps only the current version of a board', async ({ request }) => {
  const headers = await teacher(request);
  const created = await request.post('/api/teacher/boards', {
    headers,
    data: { kind: 'EXCALIDRAW', title: 'Доска 0.12.0' },
  });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  let backup: string | null = null;
  try {
    const scene = await request.put(`/api/boards/${id}/scene`, {
      headers,
      data: {
        elements: [{ id: 'e2e-0-12-0', type: 'rectangle', version: 1, versionNonce: 1 }],
        baseVersion: 0,
      },
    });
    expect(scene.ok()).toBe(true);
    expect((await request.post(`/api/teacher/boards/${id}/backups`, { headers })).ok()).toBe(true);

    const made = await request.post('/api/teacher/backups', { headers });
    expect(made.ok()).toBe(true);
    backup = ((await made.json()) as { name: string }).name;
    const archive = await request.get(`/api/teacher/backups/${backup}`, { headers });
    expect(archive.ok()).toBe(true);

    const database = zipEntry(await archive.body(), 'database.sql');
    expect(database).toContain('e2e-0-12-0');
    expect(database).toMatch(/CREATE (CACHED|MEMORY) TABLE "BOARDS"\."BOARD_BACKUPS"/);
    expect(database).not.toContain('INSERT INTO "BOARDS"."BOARD_BACKUPS"');
  } finally {
    if (backup !== null) {
      await request.delete(`/api/teacher/backups/${backup}`, { headers });
    }
    await request.delete(`/api/teacher/boards/${id}`, { headers });
  }
});
