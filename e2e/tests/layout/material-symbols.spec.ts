import { startSession } from '../support/session';
import { type Page, type Response, expect, test } from '@playwright/test';
import { create } from '../support/create';

/**
 * Version 0.17.2 (ADR-0046): icons are Material Symbols Rounded from a small subset font (hashed, cached for
 * long); the active section's icon is filled; PrimeNG's own icons are masked with our symbols; no primeicons
 * are left; the user button without a photo shows a person in a circle of the photo's size.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page): Promise<Response> {
  await page.setViewportSize({ width: 1280, height: 800 });
  const font = page.waitForResponse((response) =>
    /\/media\/symbols-\w+\.woff2$/.test(response.url()),
  );
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  return font;
}

function fill(page: Page, link: string): Promise<string> {
  return page
    .getByRole('navigation')
    .getByRole('link', { name: link })
    .locator('.tb-i')
    .evaluate((node) => getComputedStyle(node).fontVariationSettings);
}

test('icons come from the small hashed subset of Material Symbols Rounded', async ({ page }) => {
  const font = await signIn(page);
  expect(font.ok()).toBe(true);
  expect(font.headers()['cache-control']).toContain('immutable');
  expect(Number(font.headers()['content-length'] ?? (await font.body()).length)).toBeLessThan(
    100_000,
  );

  const families = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family);
  });
  expect(families.some((family) => family.includes('Material Symbols Rounded'))).toBe(true);
  expect(families.some((family) => family.toLowerCase().includes('primeicons'))).toBe(false);
});

test('the active section has a filled icon, the others are outlined', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/schedule');

  await expect.poll(() => fill(page, 'Расписание')).toContain('"FILL" 1');
  await expect.poll(() => fill(page, 'Сегодня')).toContain('"FILL" 0');
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Расписание' }).locator('.tb-i'),
  ).toHaveClass(/tb-i-calendar_month/);
});

test('no primeicons are left and PrimeNG icons show our symbols', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/schedule');
  await create(page, 'Занятие');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // the dialog's own «✕» is a symbol of the portal (ADR-0050); the PrimeNG icon here is the select's chevron
  const close = dialog.locator('svg[data-p-icon="chevron-down"]').first();
  expect(await close.evaluate((node) => getComputedStyle(node).maskImage)).toContain('svg+xml');
  // the dialog scales in: measured once it has settled
  await expect.poll(async () => Math.round((await close.boundingBox())?.width ?? 0)).toBe(24);

  const primeicons = await page.evaluate(
    () =>
      [...document.querySelectorAll('[class]')].filter((node) =>
        /(^|\s)pi(-[a-z]|\s|$)/.test(node.getAttribute('class') ?? ''),
      ).length,
  );
  expect(primeicons).toBe(0);
});
