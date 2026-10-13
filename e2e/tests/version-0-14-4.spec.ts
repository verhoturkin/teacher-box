import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.14.4: the AI assistant is a bar over the assignment text — one «Промты» menu, «Опереться на», the draft
 * above the text. The E2E instance has no AI service, so the editor shows no bar and the help tells about it.
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

test('the editor without an AI service has no assistant bar', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/homework/new');
  await expect(page.locator('#editor-text')).toBeVisible();
  await expect(page.locator('tb-homework-ai-panel')).toHaveCount(0);
});

test('the teacher reads where the assistant is in the editor', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/help/ai');
  await expect(page.getByText(/строка ИИ-помощника над полем «Текст задания»/)).toBeVisible();
  await expect(page.getByText(/«Сохранить запрос как промт»/)).toBeVisible();
});
