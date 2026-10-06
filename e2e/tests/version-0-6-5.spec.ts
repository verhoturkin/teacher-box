import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.6.5: one look for the elements of one type (ADR-0018) — the main action is the same
 * extended FAB in every section on a phone, secondary buttons are tonal (no outlined, small or
 * colored ones), «back» is an arrow next to the title, and the pages fit a phone and a tablet.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8091';
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 800, height: 1000 };
const PAGES = [
  '/teacher',
  '/teacher/students',
  '/teacher/schedule',
  '/teacher/homework',
  '/teacher/billing',
  '/teacher/billing/report',
  '/teacher/notifications',
  '/teacher/settings',
  '/teacher/account',
];

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('h1.tb-page-title')).toBeVisible();
}

test('on a phone the main action of every section is the same extended FAB', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE });
  const page = await context.newPage();
  await signIn(page);

  for (const [path, label] of [
    ['/teacher/students', 'Добавить ученика'],
    ['/teacher/schedule', 'Занятие'],
    ['/teacher/homework', 'Новое задание'],
    ['/teacher/billing', 'Оплата'],
  ] as const) {
    await open(page, path);
    const fab = page.locator('p-button.tb-page-fab');
    await expect(fab).toHaveCount(1);
    await expect(fab.getByRole('button')).toHaveText(label);
    // The FAB springs in when the page opens (ADR-0019): its size is checked once it has settled.
    await expect.poll(async () => (await fab.getByRole('button').boundingBox())?.height).toBe(56);
  }
  await context.close();
});

// Since 0.6.6 buttons are green or red by their meaning (ADR-0019); outlined, small, orange and
// blue ones stay out.
test('secondary buttons are tonal: no outlined, small, orange or blue buttons', async ({
  page,
}) => {
  await signIn(page);
  for (const path of PAGES) {
    await open(page, path);
    await expect(
      page.locator(
        '.p-button-outlined, .p-button-sm, .p-togglebutton-sm, .p-button-warn, .p-button-info',
      ),
    ).toHaveCount(0);
    // One filled button on a page at most: its main action (a split button is one button).
    const filled = await page
      .locator('main .p-button:not(.tb-split__more)')
      .evaluateAll(
        (buttons) =>
          buttons.filter(
            (button) =>
              !/p-button-(secondary|text|link|danger)/.test(button.className) &&
              button.closest('.p-dialog, .p-datepicker, .fc, .tb-tonal') === null,
          ).length,
      );
    expect(filled, path).toBeLessThanOrEqual(1);
  }
});

test('a nested page has «back» as an arrow next to its title', async ({ page }) => {
  await signIn(page);
  await open(page, '/teacher/billing/report');
  const back = page.locator('main').getByRole('link', { name: 'Оплаты', exact: true });
  await expect(back).toBeVisible();
  await expect(back).toHaveText('');
  await back.click();
  await expect(page).toHaveURL(/\/teacher\/billing$/);
});

for (const [name, viewport] of [
  ['phone', PHONE],
  ['tablet', TABLET],
] as const) {
  test(`the sections fit a ${name} without scrolling sideways`, async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport });
    const page = await context.newPage();
    await signIn(page);
    for (const path of PAGES) {
      await open(page, path);
      const overflow = await page.evaluate(() => {
        const tables = Array.from(document.querySelectorAll('.p-datatable-table-container'));
        return [
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ...tables.map((table) => table.scrollWidth - table.clientWidth - 1),
        ];
      });
      expect(Math.max(...overflow), path).toBeLessThanOrEqual(0);
    }
    await context.close();
  });
}
