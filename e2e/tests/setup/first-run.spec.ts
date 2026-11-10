import { type Page, expect, test } from '@playwright/test';
import { bearer, startSession } from '../support/session';

/**
 * The first-run wizard (ADR-0014, 365.1) on a freshly reset instance: every step is taken with its
 * defaults, then Settings show the same values. The reset empties the instance, so the file runs in
 * the `operations` project, after the ordinary suites.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

test.describe.configure({ mode: 'serial' });

async function resetInstance(page: Page): Promise<void> {
  const headers = await bearer(page.request);
  const reset = await page.request.post('/api/teacher/reset', {
    headers,
    data: { password: TEACHER_PASSWORD },
  });
  expect(reset.ok(), 'The full reset').toBe(true);
}

test('all steps with the defaults, then Settings show the chosen values', async ({ page }) => {
  await resetInstance(page);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await expect(page).toHaveURL(/\/teacher\/setup$/);

  // «Вы и портал»: the name and the address the portal is open at are prefilled
  await expect(page.getByRole('heading', { name: 'Вы и портал' })).toBeVisible();
  await expect(page.getByLabel('Ваше имя')).not.toHaveValue('');
  await expect(page.getByLabel('Адрес портала')).toHaveValue(
    process.env['E2E_BASE_URL'] ?? 'http://localhost:8091',
  );
  await page.getByRole('button', { name: 'Далее' }).click();

  // «Время и оплата»: the zone of the browser (Europe/Moscow in the run), the default price
  await expect(page.getByRole('heading', { name: 'Время и оплата' })).toBeVisible();
  const zone = (await page.locator('p-select').first().innerText()).trim();
  expect(zone).not.toBe('');
  const price = await page.getByLabel('Цена занятия').inputValue();
  await page.getByRole('button', { name: 'Далее' }).click();

  // «Правила»
  await expect(page.getByRole('heading', { name: 'Правила' })).toBeVisible();
  await page.getByRole('button', { name: 'Далее' }).click();

  // «Готово»
  await expect(page.getByRole('heading', { name: 'Портал готов' })).toBeVisible();
  await page.getByRole('button', { name: 'Перейти в портал' }).click();
  await expect(page).toHaveURL(/\/teacher$/);

  // the wizard does not come back, and Settings hold what it saved
  await page.goto('/teacher');
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto('/teacher/settings/lessons');
  await expect(page.getByRole('combobox', { name: zone })).toBeVisible();
  await expect(page.getByLabel('Цена занятия')).toHaveValue(price);
});
