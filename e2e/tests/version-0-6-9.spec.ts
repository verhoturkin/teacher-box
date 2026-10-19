import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.6.9: fixes of 0.6.8 (ADR-0021) — the notifications and the help are as wide as the
 * other sections and the contents of the help mark the current article.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, login: string, password: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function widthOfFirstCard(page: Page, path: string): Promise<number> {
  await page.goto(path);
  const card = page.locator('main .p-card, main tb-fold-card').first();
  await expect(card).toBeVisible();
  return Math.round((await card.boundingBox())?.width ?? 0);
}

test('the notifications and the help are as wide as the other sections', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1440);
  const schedule = await widthOfFirstCard(page, '/teacher/schedule');

  expect(await widthOfFirstCard(page, '/teacher/notifications')).toBe(schedule);
  // the help is list-detail from 0.21.0: version-0-21-0.spec.ts checks its panes
});

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
