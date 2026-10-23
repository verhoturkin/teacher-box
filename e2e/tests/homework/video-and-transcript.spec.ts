import { startSession } from '../support/session';
import { expect, test, type Page } from '@playwright/test';

/**
 * Version 0.19.0: videos by link in homework (ADR-0047) — a «Видео» section with the player, the title and a
 * transcript from YouTube captions or an .srt / .vtt file; the AI reads the transcripts. No network to YouTube here:
 * the transcript comes from a file.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';
const TITLE = `Видео ${String(Date.now())}`;

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

test('the teacher gives homework with a video and its transcript', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework/new');
  await page.locator('#editor-title').fill(TITLE);

  await page.getByRole('button', { name: 'Добавить видео' }).click();
  await page.getByLabel('Ссылка на видео').fill('https://youtu.be/dQw4w9WgXcQ?t=35');
  await expect(page.locator('tb-video-section iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=35',
  );
  await expect(page.getByRole('button', { name: 'Взять субтитры с YouTube' })).toBeVisible();
  await page.locator('tb-video-section').getByLabel('Название').fill('Present Simple');
  await page.locator('tb-video-section input[type="file"]').setInputFiles({
    name: 'урок.srt',
    mimeType: 'text/plain',
    buffer: Buffer.from('1\n00:00:05,000 --> 00:00:07,000\nWe play football\n', 'utf-8'),
  });
  await expect(page.locator('tb-video-section textarea')).toHaveValue('[0:05] We play football');
  await expect(page.getByText('Загружено из файла урок.srt')).toBeVisible();
  await page.getByText('Показывать расшифровку ученику').click();

  await page
    .locator('tb-page-header')
    .getByRole('button', { name: /Выдать$/ })
    .click();
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
