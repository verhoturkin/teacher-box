import { startSession } from '../support/session';
import { expect, test, type Page } from '@playwright/test';
import { create } from '../support/create';

/**
 * Student colour regression: since 0.27.0 the avatar carries the accent and the row keeps the portal surface.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

test('the colour of a student highlights their avatar while the row stays neutral', async ({
  page,
}) => {
  const student = `Строка ${Date.now()}`;
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/students');

  await create(page, 'Ученик');
  await page.getByLabel('Имя и фамилия').fill(student);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  const invite = page.getByRole('alertdialog', { name: `Ссылка для ученика: ${student}` });
  await invite.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
  await expect(invite).toBeHidden();
  // 0.23.0: the colour is chosen on the Профиль tab of the card, which opens after creating
  const details = page.locator('p-card', { hasText: 'Данные ученика' });
  await details.locator('tb-label-color-field .p-select').click();
  await page.getByRole('option', { name: 'Красный' }).click();
  await details.getByRole('button', { name: 'Сохранить' }).click();

  const row = page.locator('ul.tb-list > li', { hasText: student });
  await expect(row.locator('tb-avatar')).toHaveAttribute('data-tb-label', 'red');
  // the row of the open card is marked as current: the tint is measured with no card open
  await page.goto('/teacher/students');
  await expect(row).not.toHaveAttribute('data-tb-label');
  await expect(row.locator('tb-avatar')).toHaveAttribute('data-tb-label', 'red');

  // the avatar is distinct from the neutral tile after closing the selected card
  const tinted = await row.evaluate((li) => getComputedStyle(li).backgroundColor);
  const avatar = await row
    .locator('tb-avatar')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(avatar).not.toBe(tinted);
});
