import { startSession } from '../support/session';
import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.16.0 (M3 Expressive alignment, our own rules): the loading indicator is a 38 px shape in
 * on-primary-container inside the 48 px primary-container circle; the check on a portal colour swatch is
 * readable (≥ 4.5:1, white is short of 3:1 on teal and emerald).
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

test('the loading indicator: a 38 px shape in on-primary-container in a 48 px circle', async ({
  page,
}) => {
  await signIn(page);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/teacher/students', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/teacher/students');

  const indicator = page.locator('main .p-progressspinner').first();
  await expect(indicator).toBeVisible();
  const look = await indicator.evaluate((element) => {
    const container = getComputedStyle(element);
    const shape = getComputedStyle(element, '::after');
    const probe = document.createElement('span');
    probe.style.color = 'var(--p-md-on-primary-container)';
    document.body.append(probe);
    const onContainer = getComputedStyle(probe).color;
    probe.remove();
    return {
      size: container.width,
      shape: Math.round(parseFloat(shape.width)),
      colour: shape.backgroundColor,
      onContainer,
    };
  });
  expect(look.size).toBe('48px');
  expect(look.shape).toBe(38);
  expect(look.colour).toBe(look.onContainer);

  release();
  await expect(indicator).toHaveCount(0);
});

test('the check on every portal colour swatch is readable', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/settings?open=portal');

  const swatches = page.getByRole('radio');
  await expect(swatches.first()).toBeVisible();
  const ratios = await swatches.evaluateAll((elements) => {
    const luminance = (colour: string): number => {
      const [red = 0, green = 0, blue = 0] = (colour.match(/[\d.]+/g) ?? []).map(Number);
      const linear = (value: number): number => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
    };
    return elements
      .filter((element) => element.classList.contains('tb-accent'))
      .filter((element) => !element.classList.contains('tb-accent--own'))
      .map((element) => {
        const style = getComputedStyle(element);
        const [light, dark] = [luminance(style.backgroundColor), luminance(style.color)].sort(
          (a, b) => b - a,
        );
        return {
          name: element.getAttribute('aria-label'),
          ratio: ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05),
        };
      });
  });
  expect(ratios).toHaveLength(6);
  for (const { name, ratio } of ratios) {
    expect(ratio, name ?? '').toBeGreaterThanOrEqual(4.5);
  }
});
