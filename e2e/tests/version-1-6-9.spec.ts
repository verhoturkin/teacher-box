import { type Page, expect, test } from '@playwright/test';

/**
 * Version 1.6.9: fixes of 1.6.8 (ADR-0021) — the notifications and the help are as wide as the
 * other sections and the contents of the help are above the article.
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
  expect(await widthOfFirstCard(page, '/teacher/help')).toBe(schedule);
});

test('the contents of the help are above the article', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1440);
  await page.goto('/teacher/help/groups');

  const contents = page.getByRole('navigation', { name: 'Статьи справки' });
  const current = contents.locator('a[aria-current="page"]');
  await expect(current).toHaveText('Группы');
  const title = page.locator('.tb-help__title');
  await expect(title).toHaveText('Группы');
  const contentsBox = await contents.boundingBox();
  const titleBox = await title.boundingBox();
  expect((contentsBox?.y ?? 0) + (contentsBox?.height ?? 0)).toBeLessThan(titleBox?.y ?? 0);

  await contents.getByRole('link', { name: 'Оплаты' }).click();
  await expect(page).toHaveURL(/\/teacher\/help\/billing$/);
  await expect(page.locator('.tb-help__title')).toHaveText('Оплаты');
});

// The buttons of an upcoming lesson on a phone moved to its bottom sheet in 1.6.10 (ADR-0022):
// version-1-6-10.spec.ts checks them.
