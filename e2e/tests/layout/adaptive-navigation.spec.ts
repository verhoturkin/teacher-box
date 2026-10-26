import { startSession } from '../support/session';
import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.6: Material Design 3 (ADR-0017) — the sections in the navigation drawer, the rail and
 * the bottom navigation by the size of the window, the main action as the FAB on a phone, the
 * snackbar at the bottom and the color roles from the portal color.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8091';
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 900, height: 1000 };
const SECTIONS = [
  'Сегодня',
  'Расписание',
  // 0.22.0: no «Звонки» — a category of the settings
  'Ученики',
  'Задания',
  // 0.26.0: boards and textbooks are one section
  'Материалы',
  'Оплаты',
  // 0.22.0: no «Уведомления» — the bell's sheet
  // 0.22.0: no «ИИ-помощник» — a category of the settings
  // the bottom group of the rail (0.21.0)
  'Настройки',
  'Справка',
];

async function signIn(page: Page): Promise<void> {
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

async function expectNoSideScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('on a computer the sections are in the drawer and the current one is marked', async ({
  page,
}) => {
  await signIn(page);
  const drawer = page.getByRole('navigation', { name: 'Разделы' });
  await expect(drawer.getByRole('link')).toHaveText(SECTIONS);
  await expect(page.locator('nav.tb-bottom-nav')).toHaveCount(0);

  await drawer.getByRole('link', { name: 'Ученики' }).click();
  await expect(page).toHaveURL(/\/teacher\/students$/);
  await expect(drawer.locator('a[aria-current="page"]')).toHaveText('Ученики');
  // The page is a container and the panes (0.23.0, the students' list) lie on it lighter (M3 surfaces).
  const [page_, card] = await Promise.all([
    page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    page
      .locator('tb-pane')
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(card).not.toBe(page_);
  await expectNoSideScroll(page);
});

test('dark content panes remain distinct from the window outside compact layouts', async ({
  page,
}, testInfo) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Меню пользователя' }).click();
  await page.getByRole('menuitemradio', { name: 'Тёмная тема' }).click();
  await expect(page.locator('html')).toHaveClass(/tb-dark/);

  const pane = page.locator('main tb-pane').first();
  for (const width of [600, 900, 1600]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(pane).toBeVisible();
    await expect
      .poll(() =>
        pane.evaluate((element) => {
          const style = getComputedStyle(element);
          return style.backgroundColor !== getComputedStyle(document.body).backgroundColor;
        }),
      )
      .toBe(true);
    const expected = await pane.evaluate((element) => {
      const probe = document.createElement('div');
      probe.style.background = 'var(--p-md-surface-container-low)';
      element.append(probe);
      const result = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return result;
    });
    await expect(pane).toHaveCSS('background-color', expected);
  }
  await page.screenshot({ path: testInfo.outputPath('dark-home.png'), fullPage: true });

  await page.setViewportSize(PHONE);
  await expect(pane).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('on a tablet the sections are in the rail', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: TABLET });
  const page = await context.newPage();
  await signIn(page);

  const rail = page.locator('tb-side-nav.tb-side-nav--rail');
  await expect(rail.getByRole('link')).toHaveText(SECTIONS);
  expect((await rail.boundingBox())?.width).toBeLessThan(100);
  await rail.getByRole('link', { name: 'Оплаты' }).click();
  await expect(page).toHaveURL(/\/teacher\/billing$/);
  await expectNoSideScroll(page);
  await context.close();
});

test('on a phone the main action is the FAB above the bottom navigation', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE });
  const page = await context.newPage();
  await signIn(page);
  await expect(page.locator('tb-side-nav')).toHaveCount(0);

  // «Ученики» is back in the bar since 0.21.0 (D2)
  await page.locator('nav.tb-bottom-nav').getByRole('link', { name: 'Ученики' }).click();
  const fab = page.getByRole('button', { name: 'Добавить ученика' });
  await expect(fab).toBeVisible();
  // the FAB slides in: measure it where it stops
  await expect
    .poll(async () => {
      const box = await fab.boundingBox();
      return box === null ? 0 : box.x + box.width;
    })
    .toBeGreaterThan(PHONE.width - 40);
  const [fabBox, navBox] = await Promise.all([
    fab.boundingBox(),
    page.locator('nav.tb-bottom-nav').boundingBox(),
  ]);
  expect(fabBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  if (fabBox !== null && navBox !== null) {
    expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(navBox.y);
    expect(fabBox.x + fabBox.width).toBeGreaterThan(PHONE.width - 40);
  }

  await fab.click();
  await expect(page.getByRole('dialog', { name: 'Новый ученик' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expectNoSideScroll(page);
  await context.close();
});

test('messages are a snackbar at the bottom and buttons follow the portal color', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/account');
  const name = page.getByLabel('Имя', { exact: true });
  const current = await name.inputValue();
  const rename = async (value: string): Promise<void> => {
    await name.fill(value);
    await page.getByRole('button', { name: 'Сохранить', exact: true }).first().click();
    const snackbar = page.locator('.p-toast-message', { hasText: 'Имя сохранено' }).last();
    await expect(snackbar).toBeVisible();
    const box = await snackbar.boundingBox();
    expect(box?.y ?? 0).toBeGreaterThan((page.viewportSize()?.height ?? 0) / 2);
  };
  await rename(`${current} М3`);
  await rename(current);

  // A filled button is the primary role: a tone of the portal color readable on white (ADR-0023).
  // 0.26.0: the open button of the connected group of «Материалы»
  await page.goto('/teacher/materials');
  await expect(page.locator('.tb-segment[aria-pressed="true"]')).toBeVisible();
  const [button, shade] = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--p-md-primary)';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    const filled = document.querySelector('.tb-segment[aria-pressed="true"]');
    return [filled === null ? '' : getComputedStyle(filled).backgroundColor, color];
  });
  expect(button).toBe(shade);
});
