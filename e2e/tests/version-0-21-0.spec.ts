import { expect, test, type Page } from '@playwright/test';
import { create } from './create';

/**
 * Version 0.21.0, the shell: «Создать» at the top of the rail opens the section's form, ☰ on a phone opens
 * the modal rail (the bottom bar keeps five sections, no «Ещё»), the help is list-detail — the list and the
 * article side by side on a wide screen, one pane at a time on a phone.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1920, height: 1080 };

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('«Создать › Занятие» in the rail opens the lesson dialog in the schedule', async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher');

  await create(page, 'Занятие');
  await expect(page).toHaveURL(/\/teacher\/schedule/);
  await expect(page.getByRole('dialog', { name: 'Новое занятие' })).toBeVisible();
  // the page drops the parameter once the dialog is open
  await expect(page).not.toHaveURL(/create=/);
});

test('☰ on a phone opens the modal rail with the sections beyond the bar', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher');

  const bar = page.locator('nav.tb-bottom-nav');
  await expect(bar.getByRole('link')).toHaveCount(5);
  await expect(bar.getByText('Ещё', { exact: true })).toHaveCount(0);
  await expect(page.locator('tb-create-menu')).toHaveCount(0);

  const menu = page.getByRole('button', { name: 'Разделы' });
  await menu.click();
  const rail = page.locator('.tb-modal-rail');
  await expect(rail).toBeVisible();
  await expect(rail.locator('.tb-side-nav__brand')).toBeVisible();
  await rail.getByRole('link', { name: 'Справка' }).click();
  await expect(page).toHaveURL(/\/teacher\/help/);
  await expect(rail).toBeHidden();

  // Esc closes it too and the focus goes back to ☰
  await menu.click();
  await expect(rail).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(rail).toBeHidden();
  await expect(menu).toBeFocused();
});

test('the help shows the list and the article side by side at 1920, one pane at 390', async ({
  page,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  const list = page.getByRole('region', { name: 'Статьи справки' });
  const article = page.locator('tb-pane.tb-help__article-card');

  await page.setViewportSize(WIDE);
  await page.goto('/teacher/help/first-steps');
  await expect(list).toBeVisible();
  await expect(
    article.locator('.tb-pane__header').getByRole('heading', { name: 'Первые шаги' }),
  ).toBeVisible();
  const listBox = await list.boundingBox();
  const articleBox = await article.boundingBox();
  expect(listBox && articleBox && articleBox.x >= listBox.x + listBox.width).toBeTruthy();
  expect(listBox && articleBox && Math.abs(articleBox.y - listBox.y) < 100).toBeTruthy();

  await page.setViewportSize(PHONE);
  await expect(list).toHaveCount(0);
  await expect(article).toBeVisible();
  await page.getByRole('link', { name: 'Вся справка' }).click();
  await expect(page).toHaveURL(/\/teacher\/help$/);
  await expect(list).toBeVisible();
  await expect(article).toHaveCount(0);
  await list.getByRole('link', { name: /Первые шаги/ }).click();
  await expect(article).toBeVisible();
  await expect(list).toHaveCount(0);
});
