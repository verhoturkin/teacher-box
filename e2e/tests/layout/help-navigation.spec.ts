import { startSession } from '../support/session';
import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.6.9: fixes of 0.6.8 (ADR-0021) — the contents of the help mark the current article. (The
 * notifications page went into the bell's sheet in 0.22.0, the help became list-detail in 0.21.0.)
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, login: string, password: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await startSession(page, login, password);
}

test('the contents of the help mark the article and lead to another one', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1440);
  await page.goto('/teacher/help/groups');

  const contents = page.getByRole('navigation', { name: 'Статьи справки' });
  const current = contents.locator('a[aria-current="page"]');
  await expect(current.locator('.tb-help__item-title')).toHaveText('Группы');
  await expect(page.locator('.tb-help__title')).toHaveText('Группы');

  await contents.getByRole('link', { name: /^Оплаты/ }).click();
  await expect(page).toHaveURL(/\/teacher\/help\/billing$/);
  await expect(page.locator('.tb-help__title')).toHaveText('Оплаты');
});

// The buttons of an upcoming lesson on a phone moved to its bottom sheet in 0.6.10 (ADR-0022):
// version-0-6-10.spec.ts checks them.
