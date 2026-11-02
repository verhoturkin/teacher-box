import { startSession } from '../support/session';
import { expect, test, type Page } from '@playwright/test';

/**
 * «Субтитры YouTube» in the side sheet of a video offers a menu of tracks when a video has several. No network
 * to YouTube here: the browser gets the tracks and the transcript from routed answers of the portal's API.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

test('the teacher picks the language of YouTube captions', async ({ page }) => {
  await page.route('**/api/teacher/homework/videos/captions', (route) =>
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
  let chosen: unknown = null;
  await page.route('**/api/teacher/homework/videos/transcript', (route) => {
    chosen = route.request().postDataJSON();
    return route.fulfill({
      json: {
        title: 'Present Simple',
        language: 'ru',
        automatic: false,
        transcript: '[0:05] Мы играем',
        truncated: false,
      },
    });
  });

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework/new');
  await page.getByRole('button', { name: 'Видео', exact: true }).click();
  await page.getByLabel('Ссылка на видео').fill('https://youtu.be/dQw4w9WgXcQ');
  await page.getByRole('button', { name: 'Настроить видео: Видео 1' }).click();
  const sheet = page.getByRole('dialog', { name: 'Видео 1 из 1' });
  await sheet.getByRole('button', { name: 'Субтитры YouTube' }).click();

  const menu = page.getByRole('menu', { name: 'Субтитры на каком языке взять?' });
  const tracks = menu.getByRole('menuitem');
  await expect(tracks).toHaveCount(2);
  await expect(tracks.first()).toContainText('Английский');
  await expect(tracks.first()).toContainText('автоматические');
  await tracks.filter({ hasText: 'Русский' }).click();

  await expect(menu).toBeHidden();
  await expect(sheet.getByRole('list', { name: 'Расшифровка' })).toContainText('Мы играем');
  await expect(sheet.getByText('Субтитры YouTube: русский')).toBeVisible();
  expect(chosen).toEqual({ url: 'https://youtu.be/dQw4w9WgXcQ', language: 'ru', automatic: false });
});
