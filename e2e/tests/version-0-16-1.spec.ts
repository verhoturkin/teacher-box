import { type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.16.1 (M3 Expressive alignment, springs and buttons): a button is the M3E small one — 40 px
 * high, 16 px side padding, a 20 px icon, its corners square to 8 px while pressed; in a pressed
 * connected group the outer corners square to 8 px and the inner ones narrow to 4 px.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.locator('#login').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Holds the mouse down on the element until the shape spring settles; the release lands elsewhere. */
async function pressAndHold(page: Page, element: Locator): Promise<void> {
  await element.scrollIntoViewIfNeeded();
  const box = await element.boundingBox();
  if (!box) {
    throw new Error('the element is not on screen');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
}

async function releaseAside(page: Page): Promise<void> {
  await page.mouse.move(5, 5);
  await page.mouse.up();
}

type Corners = [string, string, string, string];

function corners(element: Locator): Promise<Corners> {
  return element.evaluate((node) => {
    const style = getComputedStyle(node);
    return [
      style.borderStartStartRadius,
      style.borderStartEndRadius,
      style.borderEndEndRadius,
      style.borderEndStartRadius,
    ] as Corners;
  });
}

test('a button: 40 px high, 16 px padding, a 20 px icon, 8 px corners while pressed', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/students');

  const button = page.locator('main .p-button:has(.p-button-label):has(.p-button-icon)').first();
  await expect(button).toBeVisible();
  const look = await button.evaluate((node) => ({
    height: node.getBoundingClientRect().height,
    padding: getComputedStyle(node).paddingInlineStart,
    icon: getComputedStyle(node.querySelector('.p-button-icon') ?? node).fontSize,
  }));
  expect(look).toEqual({ height: 40, padding: '16px', icon: '20px' });

  await pressAndHold(page, button);
  expect(await corners(button)).toEqual(['8px', '8px', '8px', '8px']);
  await releaseAside(page);
});

test('a pressed connected group: outer corners 8 px, inner ones 4 px', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/homework/new');

  const choices = page.locator('main .p-selectbutton .p-togglebutton');
  await expect(choices).toHaveCount(2);
  const first = choices.first();
  const last = choices.last();
  expect(await corners(first)).toEqual(['20px', '20px', '20px', '20px']);
  expect(await corners(last)).toEqual(['8px', '20px', '20px', '8px']);

  await pressAndHold(page, last);
  expect(await corners(last)).toEqual(['4px', '8px', '8px', '4px']);
  await releaseAside(page);
});
