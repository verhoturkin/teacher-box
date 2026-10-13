import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.14.5: files picked for a new assignment are cards like the saved ones, the name of a PDF opens it; boards
 * have their own icon. The E2E instance has no AI service, so the assistant reading picked files is covered by the
 * unit and integration tests.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  // The next page opened before the sign-in finishes would lead back to the sign-in page.
  await expect(page).not.toHaveURL(/\/login/);
}

test('files picked for a new assignment are cards, a PDF opens by its name', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework/new');
  await page.locator('tb-file-picker input[type="file"]').setInputFiles([
    { name: 'Задачи.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
    { name: 'Ответы.txt', mimeType: 'text/plain', buffer: Buffer.from('1') },
  ]);

  const picked = page.getByRole('list', { name: 'Выбранные файлы' });
  await expect(picked.getByRole('listitem')).toHaveCount(2);
  await expect(picked.getByRole('button', { name: 'Открыть Задачи.pdf' })).toBeVisible();
  await expect(picked.getByRole('button', { name: 'Открыть Ответы.txt' })).toHaveCount(0);
  await picked.getByRole('button', { name: 'Убрать Ответы.txt' }).click();
  await expect(picked.getByRole('listitem')).toHaveCount(1);
});

test('boards have their own icon in the navigation', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher');
  await expect(
    page.getByRole('link', { name: 'Доски' }).first().locator('.pi-tb-board'),
  ).toBeAttached();
});
