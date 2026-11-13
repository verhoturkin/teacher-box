import { startSession } from '../support/session';
import { type Page, expect, test } from '@playwright/test';

/** Shared Material loading feedback and portal colour contrast. */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

test('the loading indicator morphs inside a 48 px circle and follows reduced motion', async ({
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

  const indicator = page.locator('main tb-loading-indicator[role=progressbar]').first();
  await expect(indicator).toBeVisible();
  const look = await indicator.evaluate((element) => {
    const container = getComputedStyle(element);
    const path = element.querySelector('path');
    const shape = element.querySelector('g')?.getBoundingClientRect();
    const probe = document.createElement('span');
    probe.style.color = 'var(--p-md-on-primary-container)';
    document.body.append(probe);
    const onContainer = getComputedStyle(probe).color;
    probe.remove();
    return {
      size: container.width,
      shape: shape?.width ?? 0,
      colour: path ? getComputedStyle(path).fill : '',
      onContainer,
    };
  });
  expect(look.size).toBe('48px');
  expect(look.shape).toBeGreaterThan(0);
  expect(look.shape).toBeLessThanOrEqual(38.1);
  expect(look.colour).toBe(look.onContainer);

  const path = indicator.locator('path');
  const initial = await path.getAttribute('d');
  await expect.poll(() => path.getAttribute('d')).not.toBe(initial);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const snapshots = await indicator.evaluate(async (element) => {
    const frames: string[] = [];
    for (let i = 0; i < 5; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      frames.push(element.querySelector('svg')?.innerHTML ?? '');
    }
    return frames;
  });
  expect(new Set(snapshots).size).toBe(1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const still = await path.getAttribute('d');
  await expect.poll(() => path.getAttribute('d')).not.toBe(still);

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
      .filter((element) => element.classList.contains('tb-swatch'))
      .filter((element) => element.querySelector('.tb-swatch__dot--own') === null)
      .map((element) => {
        const style = getComputedStyle(element.querySelector('.tb-swatch__dot') ?? element);
        const [light, dark] = [luminance(style.backgroundColor), luminance(style.color)].sort(
          (a, b) => b - a,
        );
        return {
          name: (element.textContent ?? '').trim(),
          ratio: ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05),
        };
      });
  });
  expect(ratios.map(({ name }) => name).filter((name) => name !== 'Текущий цвет')).toEqual([
    'Индиго',
    'Синий',
    'Барвинок',
    'Изумруд',
    'Малина',
    'Персик',
    'Мокко',
    'Золото',
    'Облако',
  ]);
  for (const { name, ratio } of ratios) {
    expect(ratio, name ?? '').toBeGreaterThanOrEqual(4.5);
  }
});
