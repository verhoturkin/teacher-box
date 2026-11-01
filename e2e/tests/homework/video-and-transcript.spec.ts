import { bearer, startSession } from '../support/session';
import { expect, test, type Page } from '@playwright/test';

/**
 * Videos by link in homework (ADR-0047): a tile per video, its side sheet with the player, the title and a
 * transcript from YouTube captions or an .srt / .vtt file; the AI reads the transcripts. No network to YouTube here:
 * the transcript comes from a file.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';
const TITLE = `Видео ${String(Date.now())}`;

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

test('the teacher gives homework with a video and its transcript', async ({ page, request }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework/new');
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/teacher/homework/assignments'),
  );
  await page.locator('#editor-text').fill(TITLE);

  await page.getByRole('button', { name: 'Видео', exact: true }).click();
  await page.getByLabel('Ссылка на видео').fill('https://youtu.be/dQw4w9WgXcQ?t=35');
  const tiles = page.locator('tb-video-section').getByRole('list', { name: 'Видео задания' });
  await expect(tiles).toContainText('YouTube · с 0:35');
  await expect(tiles).toContainText('Без расшифровки');
  await expect(tiles.locator('img')).toHaveAttribute(
    'src',
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  );

  await page.getByRole('button', { name: 'Настроить видео: Видео 1' }).click();
  const sheet = page.getByRole('dialog', { name: 'Видео 1 из 1' });
  await expect(sheet.locator('iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=35',
  );
  await expect(sheet.getByRole('button', { name: 'Субтитры YouTube' })).toBeVisible();
  await sheet.getByLabel('Название').fill('Present Simple');
  await sheet.locator('input[type="file"]').setInputFiles({
    name: 'урок.srt',
    mimeType: 'text/plain',
    buffer: Buffer.from('1\n00:00:05,000 --> 00:00:07,000\nWe play football\n', 'utf-8'),
  });
  await expect(sheet.getByText('Загружено из файла урок.srt')).toBeVisible();
  await expect(sheet.getByRole('list', { name: 'Расшифровка' })).toContainText(
    '0:05We play football',
  );
  await sheet.getByText('Показывать расшифровку ученику').click();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(tiles).toContainText('Present Simple');
  await expect(tiles).toContainText('видит ученик');

  // the draft saves itself: wait until the video with its transcript is stored
  const { id } = (await (await created).json()) as { id: string };
  const headers = await bearer(request);
  await expect
    .poll(async () => {
      const response = await request.get(`/api/teacher/homework/assignments/${id}`, { headers });
      const body = (await response.json()) as { videos: { transcriptShown: boolean }[] };
      return body.videos[0]?.transcriptShown ?? false;
    })
    .toBe(true);
  await page.goto(`/teacher/homework/${id}`);
  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();

  const videos = page.getByRole('list', { name: 'Видео задания' });
  await expect(videos).toContainText('Present Simple');
  await expect(videos).toContainText('ученик видит расшифровку');
  await videos.getByRole('button', { name: 'Расшифровка' }).click();
  await expect(videos).toContainText('[0:05] We play football');
});

test('the administrator sees the proxy for YouTube captions', async ({ page }) => {
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/admin/settings/homework');

  await expect(page.locator('#setting-TEACHERBOX_HOMEWORK_YOUTUBE_PROXY')).toBeVisible();
});
