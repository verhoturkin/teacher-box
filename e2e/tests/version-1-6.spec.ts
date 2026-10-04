import { type Page, expect, test } from '@playwright/test';

/**
 * Version 1.6: Material Design 3 (ADR-0017) — the sections in the navigation drawer, the rail and
 * the bottom navigation by the size of the window, the main action as the FAB on a phone, the
 * snackbar at the bottom and the color roles from the portal color.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8091';
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 900, height: 1000 };
const SECTIONS = [
  'Главная',
  'Расписание',
  'Ученики',
  'Задания',
  'Оплаты',
  'Уведомления',
  'ИИ-помощник',
];

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
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
  // The page is a container and the cards lie on it lighter (M3 surfaces).
  const [page_, card] = await Promise.all([
    page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    page
      .locator('.p-card')
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(card).not.toBe(page_);
  await expectNoSideScroll(page);
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

  await page.locator('nav.tb-bottom-nav').getByRole('link', { name: 'Ученики' }).click();
  const fab = page.getByRole('button', { name: 'Добавить ученика' });
  await expect(fab).toBeVisible();
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
  await page.goto('/teacher/students');
  await expect(page.getByRole('button', { name: 'Добавить ученика' }).first()).toBeVisible();
  const [button, shade] = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--p-md-primary)';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    const filled = document.querySelector('.tb-page-fab .p-button');
    return [filled === null ? '' : getComputedStyle(filled).backgroundColor, color];
  });
  expect(button).toBe(shade);
});
