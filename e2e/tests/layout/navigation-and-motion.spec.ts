import { startSession } from '../support/session';
import { type Page, expect, test } from '@playwright/test';
import { create } from '../support/create';

/**
 * Version 0.16.3 (M3 Expressive alignment, navigation and motion): the flexible navigation bar is 64 px with a
 * 56x32 indicator and no top border, the collapsed rail is 96 px, and a dialog enters on the M3E springs (scale on
 * a spatial spring, opacity on an effects spring) instead of PrimeNG's animation, and the help side sheet
 * leaves without flashing back.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 800 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

test('the bottom bar is 64 px, its indicator 56x32, no border on top', async ({ page }) => {
  await signIn(page, 360);
  await page.goto('/teacher/schedule');

  const bar = page.locator('nav.tb-bottom-nav');
  await expect(bar).toBeVisible();
  const look = await bar.evaluate((node) => ({
    height: Math.round(node.getBoundingClientRect().height),
    border: getComputedStyle(node).borderTopWidth,
  }));
  expect(look).toEqual({ height: 64, border: '0px' });

  const indicator = page.locator('.tb-bottom-nav__item--active .tb-bottom-nav__icon');
  const size = await indicator.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return [Math.round(box.width), Math.round(box.height)];
  });
  expect(size).toEqual([56, 32]);
});

test('the collapsed rail is 96 px', async ({ page }) => {
  await signIn(page, 900);
  const rail = page.locator('tb-side-nav.tb-side-nav--rail');
  await expect(rail).toBeVisible();
  expect(Math.round((await rail.boundingBox())?.width ?? 0)).toBe(96);
});

test('a dialog enters on the M3E springs', async ({ page }) => {
  await signIn(page, 1280);
  await page.goto('/teacher/students');
  await page.evaluate(() => {
    const names: string[] = [];
    (window as unknown as { tbAnimations: string[] }).tbAnimations = names;
    document.addEventListener(
      'animationstart',
      (event) => {
        if (event.target instanceof Element && event.target.classList.contains('p-dialog')) {
          names.push(event.animationName);
        }
      },
      true,
    );
  });
  await create(page, 'Ученик');
  await expect(page.locator('.p-dialog')).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(() =>
        [...(window as unknown as { tbAnimations: string[] }).tbAnimations].sort(),
      ),
    )
    .toEqual(['tb-motion-fade-in', 'tb-motion-scale-in']);
});

test('the help side sheet leaves without flashing back in its place', async ({ page }) => {
  await signIn(page, 1280);
  await page.goto('/teacher/schedule');
  await page.locator('tb-help-button button').click();
  const sheet = page.locator('.p-drawer.tb-side-sheet');
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(1000);

  // sample the left edge of the sheet every frame from the click until it is gone
  const lefts = await page.evaluate(async () => {
    const seen: number[] = [];
    const close = document.querySelector<HTMLButtonElement>(
      '.p-drawer.tb-side-sheet button[aria-label="Закрыть"]',
    );
    close?.click();
    const start = performance.now();
    for (;;) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const node = document.querySelector('.p-drawer.tb-side-sheet');
      if (node === null || performance.now() - start > 2000) {
        return seen;
      }
      seen.push(node.getBoundingClientRect().left);
    }
  });
  expect(lefts.length).toBeGreaterThan(0);
  // once it starts moving out it never comes back to the left
  const furthest = lefts.reduce((max, left, index) => (index > 0 ? Math.max(max, left) : left));
  expect(lefts.at(-1)).toBeGreaterThanOrEqual(furthest - 20);
});
