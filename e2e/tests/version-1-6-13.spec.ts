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
 * Version 1.6.13 (ADR-0019): the bell is an icon link, the switch handle follows M3.
 */
test('the bell is a 40 px link to the notifications', async ({ page }) => {
  await signIn(page);
  const bell = page.getByRole('link', { name: /^Уведомления/ });
  await expect(bell).toHaveAttribute('href', '/teacher/notifications');
  const box = await bell.boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(40);
  expect(Math.round(box?.height ?? 0)).toBe(40);
});

test('a switch has a 24 px handle when on and 16 px when off', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/settings');
  const handles = page.locator('.p-toggleswitch-handle');
  await expect(handles.first()).toBeVisible();
  const sizes = await handles.evaluateAll((all) =>
    all.map((handle) => ({
      on: handle.closest('.p-toggleswitch')?.classList.contains('p-toggleswitch-checked'),
      width: Math.round(handle.getBoundingClientRect().width),
    })),
  );
  for (const { on, width } of sizes) {
    expect(width).toBe(on ? 24 : 16);
  }
});
