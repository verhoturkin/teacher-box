import { expect, test } from '@playwright/test';

/**
 * Version 0.17.3: the search magnifier is centred in the search bar again. After the move to
 * Material Symbols Rounded (0.17.2) the 24 px symbol lived in PrimeNG's icon slot centred for
 * its 16 px icon, so the loupe sat 4 px low.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

test('the search magnifier is vertically centred in the search bar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/login');
  await page.locator('#login').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto('/teacher/students');
  const bar = page.locator('tb-search-field').first();
  await expect(bar).toBeVisible();

  const gap = await bar.evaluate((node) => {
    const icon = node.querySelector('.p-inputicon');
    const input = node.querySelector('input');
    if (icon === null || input === null) {
      return null;
    }
    const loupe = icon.getBoundingClientRect();
    const field = input.getBoundingClientRect();
    return Math.abs(loupe.top + loupe.height / 2 - (field.top + field.height / 2));
  });
  expect(gap).not.toBeNull();
  expect(gap as number).toBeLessThanOrEqual(2);
});
