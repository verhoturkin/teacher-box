import { startSession } from '../support/session';
import { expect, test, type Page } from '@playwright/test';

/**
 * Version 0.19.1: «Взять субтитры с YouTube» asks which caption track to take when a video has several. No network
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
  await page.getByRole('button', { name: 'Взять субтитры с YouTube' }).click();

  const dialog = page.getByRole('alertdialog', { name: 'Субтитры на каком языке взять?' });
  const tracks = dialog.getByRole('radio');
  await expect(tracks).toHaveCount(2);
  await expect(tracks.first()).toBeChecked();
  await expect(dialog).toContainText('Автоматические — распознал YouTube');
  await dialog.locator('label', { hasText: 'Русский' }).click();
  await dialog.getByRole('button', { name: 'Взять' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.locator('tb-video-section textarea')).toHaveValue('[0:05] Мы играем');
  await expect(page.getByText('Субтитры YouTube: русский')).toBeVisible();
  expect(chosen).toEqual({ url: 'https://youtu.be/dQw4w9WgXcQ', language: 'ru', automatic: false });
});
