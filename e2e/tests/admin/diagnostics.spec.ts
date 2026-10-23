import { startSession } from '../support/session';
import { expect, test } from '@playwright/test';

/**
 * The administrator (TEACHERBOX_IDENTITY_ADMIN_PASSWORD) finds requests in the log by their code, sees the
 * state of the instance and checks the integrations, but cannot open the teacher's area.
 */

const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';

test('the administrator searches the log and checks the instance', async ({ page }) => {
  await startSession(page, 'admin', ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/admin\/status$/);
  await page.getByRole('link', { name: 'Журнал' }).first().click();
  await expect(page).toHaveURL(/\/admin\/logs/);
  await expect(page.getByRole('heading', { name: 'Журнал', level: 1 })).toBeVisible();

  await page.getByLabel('Текст').fill('role=ADMIN');
  await page.getByRole('button', { name: 'Найти' }).click();
  const signIn = page
    .getByRole('listitem')
    .filter({ hasText: /Sign-in succeeded: .*role=ADMIN/ })
    .first();
  await expect(signIn).toBeVisible();

  // The entry opens beside the list; the request code of the line finds every line of that request.
  await signIn.getByRole('button').click();
  await page.getByRole('button', { name: /^код / }).click();
  await page.getByText('Ещё фильтры').click();
  await expect(page.getByLabel('Код ошибки')).not.toHaveValue('');
  await expect(page.getByRole('listitem').filter({ hasText: 'role=ADMIN' }).first()).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Состояние' })
    .click();
  await expect(page.getByText('diskSpace', { exact: true })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Интеграции' })
    .click();
  await expect(page.getByText('Google Календарь')).toBeVisible();
  await expect(page.getByText('Провайдер не выбран (TEACHERBOX_AI_PROVIDER)')).toBeVisible();

  await page.goto('/teacher');
  await expect(page).toHaveURL(/\/admin\/status$/);
});
