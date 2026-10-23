import { startSession } from '../support/session';
import { type Page, expect, test } from '@playwright/test';

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

/**
 * Version 0.6.13 (ADR-0019): the bell is an icon button, the switch handle follows M3.
 */
test('the bell is a 40 px icon button of the notifications sheet', async ({ page }) => {
  await signIn(page);
  // 0.22.0: it opens the notifications side sheet (235.1), no longer a link to a page
  const bell = page.locator('tb-notification-bell').getByRole('button', { name: /^Уведомления/ });
  await expect(bell).toHaveAttribute('aria-expanded', 'false');
  const box = await bell.boundingBox();
  expect(Math.round(box?.width ?? 0)).toBe(40);
  expect(Math.round(box?.height ?? 0)).toBe(40);
});

test('a switch has a 24 px handle when on and 16 px when off', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/settings/calls');
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
