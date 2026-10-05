import { type Page, expect, test } from '@playwright/test';

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Version 1.6.12 (ADR-0026, ADR-0027): the buttons of windows and the bottom navigation.
 */
test('«Отмена» of a form is neutral and a button is 40 px high', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/students');
  await page.getByRole('button', { name: 'Добавить ученика' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Новый ученик' });
  const cancel = dialog.getByRole('button', { name: 'Отмена' });
  await expect(cancel).toHaveClass(/p-button-secondary/);
  // the dialog grows in when it opens: measured once it stands still
  const save = dialog.getByRole('button', { name: 'Сохранить' });
  await expect.poll(async () => Math.round((await save.boundingBox())?.height ?? 0)).toBe(40);
});

test('an unknown page of the teacher keeps the frame', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/no-such-page');
  await expect(page.getByRole('heading', { name: 'Страница не найдена', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Разделы' })).toBeVisible();
});
