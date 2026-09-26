import { expect, test } from '@playwright/test';

/**
 * The administrator (TEACHERBOX_IDENTITY_ADMIN_PASSWORD) finds requests in the log by their code, sees the
 * state of the instance and checks the integrations, but cannot open the teacher's area.
 */

const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';

test('the administrator searches the log and checks the instance', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Логин').fill('admin');
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/admin\/logs$/);
  await expect(page.getByRole('heading', { name: 'Журнал' })).toBeVisible();

  await page.getByLabel('Текст').fill('role=ADMIN');
  await page.getByRole('button', { name: 'Найти' }).click();
  const signIn = page.getByRole('row').filter({ hasText: /Sign-in succeeded: .*role=ADMIN/ }).first();
  await expect(signIn).toBeVisible();

  // The request code of the line finds every line of that request.
  await signIn.getByRole('button', { name: /^код / }).click();
  await expect(page.getByLabel('Код ошибки')).not.toHaveValue('');
  await expect(page.getByRole('row').filter({ hasText: 'role=ADMIN' }).first()).toBeVisible();

  await page.getByRole('menuitem', { name: 'Состояние' }).click();
  await expect(page.getByText('db: UP')).toBeVisible();

  await page.getByRole('menuitem', { name: 'Интеграции' }).click();
  await expect(page.getByText('Google Календарь')).toBeVisible();
  await expect(page.getByText('Провайдер не выбран (TEACHERBOX_AI_PROVIDER)')).toBeVisible();

  await page.goto('/teacher');
  await expect(page).toHaveURL(/\/admin\/logs$/);
});
