import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.14.3: OpenRouter and DeepSeek are AI services of their own — the administrator picks them in the
 * settings, the help tells the teacher and the administrator about them.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  // The next page opened before the sign-in finishes would lead back to the sign-in page.
  await expect(page).not.toHaveURL(/\/login/);
}

test('the administrator chooses OpenRouter as the AI service', async ({ page }) => {
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/admin/settings?open=ai');
  const setting = page
    .locator('.tb-setting')
    .filter({ has: page.locator('#setting-TEACHERBOX_AI_PROVIDER') });
  await setting.locator('p-select').click();
  await page.getByRole('option', { name: 'openrouter', exact: true }).click();

  await expect(setting).toContainText('openrouter');
  await expect(setting).toContainText('изменено');
  await expect(page.getByRole('button', { name: /Сохранить и перезапустить$/ })).toBeEnabled();

  await setting.locator('p-select').click();
  await page.getByRole('option', { name: 'deepseek', exact: true }).click();
  await expect(setting).toContainText('deepseek');

  await page.goto('/admin/help/settings');
  await expect(page.getByText(/Для OpenRouter \(openrouter\) хватит ключа/)).toBeVisible();
  await expect(page.getByText(/Для DeepSeek \(deepseek\)/)).toBeVisible();
});

test('the teacher reads which AI services can be connected', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/help/ai');
  await expect(page.getByText(/Claude, Gemini, DeepSeek, OpenRouter/)).toBeVisible();
});
