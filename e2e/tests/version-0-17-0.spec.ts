import { type Page, expect, test } from '@playwright/test';
import { create } from './create';

/**
 * Version 0.17.0 (ADR-0045, one accent): the main action of a page or a dialog is filled primary — the colour
 * of the portal, never green; section saves are neutral tonal; a red filled button appears only to confirm a
 * destruction in a dialog; a green portal colour no longer gets a warning.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

const PAGES = [
  '/teacher',
  '/teacher/students',
  '/teacher/schedule',
  '/teacher/homework',
  '/teacher/billing',
  '/teacher/settings',
  '/teacher/account',
];

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/login');
  await page.locator('#login').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

function background(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);
}

test('no green buttons and no filled red ones on the pages', async ({ page }) => {
  await signIn(page);
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator('h1.tb-page-title')).toBeAttached();
    await expect(page.locator('.p-button-success'), path).toHaveCount(0);
    await expect(page.locator('main .p-button-danger:not(.p-button-text)'), path).toHaveCount(0);
  }
});

test('a dialog submits with the portal colour, like the main action of the page', async ({
  page,
}) => {
  await signIn(page);
  // the main action of a section outside «Создать» (232.2): the header button of the textbooks
  await page.goto('/teacher/textbooks');
  const main = page.locator('main').getByRole('button', { name: 'Новый учебник' }).first();
  await expect(main).toBeVisible();
  const accent = await main.evaluate((node) => getComputedStyle(node).backgroundColor);

  await page.goto('/teacher/students');
  await create(page, 'Ученик');
  const dialog = page.getByRole('dialog', { name: 'Новый ученик' });
  await expect(dialog).toBeVisible();
  const save = dialog.getByRole('button', { name: 'Сохранить' });
  await expect(save).not.toHaveClass(/p-button-(success|secondary|text|danger)/);
  expect(await save.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(accent);
  await dialog.getByRole('button', { name: 'Отмена' }).click();
  await expect(dialog).toBeHidden();
});

test('a section save is neutral tonal', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/account');
  const save = page.locator('main').getByRole('button', { name: 'Сохранить' }).first();
  await expect(save).toHaveClass(/p-button-secondary/);
  await expect(save).not.toHaveClass(/p-button-text/);
  expect(await background(page, 'main .p-button-secondary:not(.p-button-text)')).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
});

test('a green portal colour gets no warning', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/settings?open=portal');
  const card = page.locator('#portal');
  const green = card.getByRole('radio', { name: 'Изумрудный' });
  await green.click();
  await expect(green).toHaveAttribute('aria-checked', 'true');
  await expect(card.locator('p-message')).toHaveCount(0);
});
