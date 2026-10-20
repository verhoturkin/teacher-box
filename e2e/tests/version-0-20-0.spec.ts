import { expect, test, type Page } from '@playwright/test';
import { create } from './create';

/**
 * Version 0.20.0: the teacher gives a student and a group a colour from a fixed palette; their rows in the list
 * (0.20.1; the avatar in 0.20.0) and the chips of the group's member picker take it.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function pickColor(
  page: Page,
  name: string,
  where = page.getByRole('dialog'),
): Promise<void> {
  await where.locator('tb-label-color-field .p-select').click();
  await page.getByRole('option', { name }).click();
  await expect(where.locator('tb-label-color-field .p-select')).toContainText(name);
}

test('the teacher colours a student and a group', async ({ page }) => {
  const student = `Цвет ${Date.now()}`;
  const group = `Группа ${Date.now()}`;
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/students');

  await create(page, 'Ученик');
  await page.getByLabel('Имя и фамилия').fill(student);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  // the invitation link opens after saving
  const invite = page.getByRole('dialog', { name: `Ссылка для ученика: ${student}` });
  await invite.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
  await expect(invite).toBeHidden();
  // 0.23.0: the colour is on the Профиль tab of the card, which opens after creating
  const details = page.locator('p-card', { hasText: 'Данные ученика' });
  await pickColor(page, 'Фиолетовый', details);
  await details.getByRole('button', { name: 'Сохранить' }).click();

  const row = page.locator('li', { hasText: student });
  await expect(row).toHaveAttribute('data-tb-label', 'violet');

  await page.getByRole('button', { name: 'Создать группу' }).click();
  await page.getByLabel('Название').fill(group);
  await page.locator('p-multiselect:has(#group-members)').click();
  await page.getByRole('option', { name: student }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog').locator('.p-multiselect-chip', { hasText: student }),
  ).toHaveAttribute('data-tb-label', 'violet');
  await pickColor(page, 'Салатовый');
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();

  await expect(page.locator('li', { hasText: group })).toHaveAttribute('data-tb-label', 'lime');
});
