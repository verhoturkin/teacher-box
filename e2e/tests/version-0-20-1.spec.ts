import { expect, test, type Page } from '@playwright/test';
import { create } from './create';

/**
 * Version 0.20.1: the colour of a student tints the background of their row (a tile from the same tones as any
 * row), the avatar keeps the colours of the theme.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('the colour of a student tints their row, not the avatar', async ({ page }) => {
  const student = `Строка ${Date.now()}`;
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/students');

  await create(page, 'Ученик');
  await page.getByLabel('Имя и фамилия').fill(student);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  const invite = page.getByRole('dialog', { name: `Ссылка для ученика: ${student}` });
  await invite.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
  await expect(invite).toBeHidden();
  // 0.23.0: the colour is chosen on the Профиль tab of the card, which opens after creating
  const details = page.locator('p-card', { hasText: 'Данные ученика' });
  await details.locator('tb-label-color-field .p-select').click();
  await page.getByRole('option', { name: 'Красный' }).click();
  await details.getByRole('button', { name: 'Сохранить' }).click();

  const row = page.locator('ul.tb-list > li', { hasText: student });
  await expect(row).toHaveAttribute('data-tb-label', 'red');
  // the row of the open card is marked as current: the tint is measured with no card open
  await page.goto('/teacher/students');
  await expect(row).toHaveAttribute('data-tb-label', 'red');
  await expect(row.locator('tb-avatar')).not.toHaveAttribute('data-tb-label', /.*/);

  // the tile takes the surface of the colour's scheme, the avatar keeps the secondary container of the theme
  const tinted = await row.evaluate((li) => getComputedStyle(li).backgroundColor);
  const avatar = await row
    .locator('tb-avatar')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(avatar).not.toBe(tinted);
});
