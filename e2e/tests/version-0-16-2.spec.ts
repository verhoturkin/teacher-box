import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { create } from './create';

/**
 * Version 0.16.2 (M3 Expressive alignment, shape and type): a list nests its outer corners in its card (4 px on a
 * computer, 8 px in a phone card), a dialog is surface-container-high, the active item of the bottom bar has a Bold
 * label in secondary and no label of the bar is cut on a 360 px phone.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик 0.16.2 ${RUN}`;

async function signIn(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.locator('#login').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function bearer(request: APIRequestContext): Promise<string> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

/** The colour of a role as the browser computes it, to compare with a computed background. */
function role(page: Page, name: string): Promise<string> {
  return page.evaluate((variable) => {
    const probe = document.createElement('div');
    probe.style.background = `var(${variable})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, name);
}

function firstCorner(element: Locator): Promise<string> {
  return element.evaluate((node) => getComputedStyle(node).borderStartStartRadius);
}

test.beforeAll(async ({ request }) => {
  const token = await bearer(request);
  const response = await request.post('/api/teacher/students', {
    headers: { Authorization: `Bearer ${token}` },
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(response.ok()).toBe(true);
});

test('a list on its pane keeps the large corner of the M3 list: 16 px on a computer and on a phone', async ({
  page,
}) => {
  await signIn(page, 1280);
  await page.goto('/teacher/students');
  const first = page.locator('main .tb-list > li').first();
  await expect(first).toBeVisible();
  expect(await firstCorner(first)).toBe('16px');

  // 0.24.1: a list lies right on the pane (no card around it): the group keeps the 16 px of the M3 list
  await page.setViewportSize({ width: 360, height: 800 });
  await expect.poll(() => firstCorner(first)).toBe('16px');
});

test('a dialog is surface-container-high', async ({ page }) => {
  await signIn(page, 1280);
  await page.goto('/teacher/students');
  await create(page, 'Ученик');
  const dialog = page.locator('.p-dialog');
  await expect(dialog).toBeVisible();

  const background = await dialog.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(background).toBe(await role(page, '--p-md-surface-container-high'));
});

test('the bottom bar: the active label Bold in secondary, no label cut at 360 px', async ({
  page,
}) => {
  await signIn(page, 360);
  await page.goto('/teacher/schedule');

  const active = page.locator('.tb-bottom-nav__item--active');
  await expect(active).toContainText('Расписание');
  const look = await active.evaluate((node) => ({
    weight: getComputedStyle(node).fontWeight,
    color: getComputedStyle(node).color,
  }));
  expect(look).toEqual({ weight: '700', color: await role(page, '--p-md-secondary') });

  const cut = await page
    .locator('.tb-bottom-nav__label')
    .evaluateAll((labels) =>
      labels
        .filter((label) => label.scrollWidth > label.clientWidth || label.clientHeight > 20)
        .map((label) => label.textContent),
    );
  expect(cut).toEqual([]);
});
