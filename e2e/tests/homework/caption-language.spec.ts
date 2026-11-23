import { startSession } from '../support/session';
import { expect, test, type Page } from '@playwright/test';

/**
 * A YouTube link takes its captions at once (the suggested track, 459.2); «Сменить язык» under the tile offers a
 * menu of tracks, in the video dialog too; a video with one language says so (468.1). No network to YouTube here: the browser gets the tracks and the transcripts from routed answers
 * of the portal's API.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

test('the teacher picks the language of YouTube captions', async ({ page }) => {
  await page.route('**/api/teacher/textbooks/videos/captions', (route) =>
    route.fulfill({
      json: {
        title: 'Present Simple',
        tracks: [
          { language: 'ru', automatic: false },
          { language: 'en', automatic: true },
        ],
        suggested: { language: 'en', automatic: true },
      },
    }),
  );
  const asked: unknown[] = [];
  await page.route('**/api/teacher/textbooks/videos/transcript', (route) => {
    const body = route.request().postDataJSON() as { language?: string };
    asked.push(body);
    return route.fulfill({
      json:
        body.language === 'ru'
          ? {
              title: 'Present Simple',
              language: 'ru',
              automatic: false,
              transcript: '[0:05] Мы играем',
              truncated: false,
              otherTracks: true,
            }
          : {
              title: 'Present Simple',
              language: 'en',
              automatic: true,
              transcript: '[0:05] We play',
              truncated: false,
              otherTracks: true,
            },
    });
  });

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework/new');
  await page.getByRole('button', { name: 'Видео', exact: true }).click();
  await page.getByLabel('Ссылка на видео').fill('https://youtu.be/dQw4w9WgXcQ');
  const section = page.locator('tb-video-section');
  await expect(section).toContainText('Субтитры: английский, автоматические · Сменить язык');
  await expect(section).toContainText('Present Simple');
  await section.getByRole('button', { name: 'Сменить язык' }).click();

  const menu = page.getByRole('menu', { name: 'Субтитры на каком языке взять?' });
  const tracks = menu.getByRole('menuitem');
  await expect(tracks).toHaveCount(2);
  await expect(tracks.first()).toContainText('Английский');
  await expect(tracks.first()).toContainText('автоматические');
  await tracks.filter({ hasText: 'Русский' }).click();

  await expect(menu).toBeHidden();
  await expect(section).toContainText('Субтитры: русский · Сменить язык');
  expect(asked).toEqual([
    { url: 'https://youtu.be/dQw4w9WgXcQ' },
    { url: 'https://youtu.be/dQw4w9WgXcQ', language: 'ru', automatic: false },
  ]);
  await page.getByRole('button', { name: 'Настроить видео: Present Simple' }).click();
  const sheet = page.getByRole('dialog', { name: 'Видео 1 из 1' });
  await expect(sheet.getByRole('list', { name: 'Расшифровка' })).toContainText('Мы играем');

  // 468.1: in the dialog too the menu opens and stays, and the player is not reloaded
  const player = sheet.locator('iframe');
  const src = await player.getAttribute('src');
  await sheet.getByRole('button', { name: 'Сменить язык' }).click();
  await expect(menu).toBeVisible();
  await tracks.filter({ hasText: 'Английский' }).click();
  await expect(sheet).toContainText('Субтитры: английский, автоматические · Сменить язык');
  expect(await player.getAttribute('src')).toBe(src);

  // 354.3: the settings are a dialog over the editor; the change is kept, «Готово» only closes it
  await sheet.getByRole('button', { name: 'Готово' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('tb-video-section')).toContainText('Расшифровка');
});

test('a video with captions in one language says so at once', async ({ page }) => {
  await page.route('**/api/teacher/textbooks/videos/transcript', (route) =>
    route.fulfill({
      json: {
        title: 'Phonics',
        language: 'en',
        automatic: true,
        transcript: '[0:01] Hello',
        truncated: false,
        otherTracks: false,
      },
    }),
  );

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework/new');
  await page.getByRole('button', { name: 'Видео', exact: true }).click();
  await page.getByLabel('Ссылка на видео').fill('https://youtu.be/aaaaaaaaaaa');
  const section = page.locator('tb-video-section');
  await expect(section).toContainText(
    'Субтитры: английский, автоматические. Других языков у этого видео нет',
  );
  await expect(section.getByRole('button', { name: 'Сменить язык' })).toHaveCount(0);
});
