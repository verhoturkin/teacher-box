import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * The design gallery (ADR-0059): a page of development builds only. The instance under test runs the
 * production images, so there it must not exist; the accessibility check runs against a development
 * server named by E2E_GALLERY_URL (`npm start` in frontend/, e.g. http://localhost:4200). Screenshots
 * of the gallery are not compared yet: fonts differ between machines.
 */
const GALLERY_URL = process.env['E2E_GALLERY_URL'];

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

test('production has no design gallery', async ({ page }) => {
  await page.goto('/gallery');
  await expect(page.locator('main.tb-not-found-page')).toBeVisible();
  await expect(page.locator('tb-gallery-page')).toHaveCount(0);
});

for (const { name, width, height } of WIDTHS) {
  for (const theme of ['light', 'dark'] as const) {
    test(`the gallery has no critical or serious axe violations (${name}, ${theme})`, async ({
      page,
    }) => {
      test.skip(GALLERY_URL === undefined, 'E2E_GALLERY_URL names no development server');
      await page.setViewportSize({ width, height });
      await page.addInitScript((choice) => {
        localStorage.setItem('tb.theme', choice);
      }, theme);
      await page.goto(`${GALLERY_URL ?? ''}/gallery`);
      await expect(page.locator('.tb-gallery-sample').first()).toBeVisible();

      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      const severe = result.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      );
      expect(
        severe.map((violation) => `${violation.id}: ${violation.nodes[0]?.target.join(' ') ?? ''}`),
      ).toEqual([]);
    });
  }
}
