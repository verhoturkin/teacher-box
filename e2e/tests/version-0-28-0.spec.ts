import { expect, test } from '@playwright/test';
import { create } from './create';

const PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/login');
  await page.getByLabel('Логин', { exact: true }).fill('teacher');
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
});

test('help keeps full-width search and a fixed gap above scrolling content', async ({ page }) => {
  await page.goto('/teacher/help/groups');
  const panes = page.locator('tb-pane');
  const search = panes.first().locator('tb-search-field');
  await expect(search).toBeVisible();
  const geometry = await panes.first().evaluate((pane) => {
    const heading = pane.querySelector('.tb-pane__header');
    const field = pane.querySelector('tb-search-field');
    if (!heading || !field) throw new Error('Missing help heading/search');
    return {
      width: field.getBoundingClientRect().width,
      available: heading.clientWidth - 48,
    };
  });
  expect(geometry.width).toBeCloseTo(geometry.available, 0);
  const scroll = panes.first().locator('.tb-pane__scroll');
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.getByRole('heading', { name: 'Справка', exact: true })).toBeVisible();
  const gap = await panes.first().evaluate((pane) => {
    const field = pane.querySelector('tb-search-field');
    const viewport = pane.querySelector('.tb-pane__scroll');
    if (!field || !viewport) throw new Error('Missing search/scroll viewport');
    return viewport.getBoundingClientRect().top - field.getBoundingClientRect().bottom;
  });
  expect(gap).toBe(16);
  expect(await scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const article = panes.last().locator('article');
  await expect(article).toBeVisible();
  expect(
    await article.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeGreaterThan(600);
});

test('creation offers student or group with normal spacing and keyboard-only focus rings', async ({
  page,
}) => {
  await page.goto('/teacher/students');
  await expect(page.getByRole('button', { name: 'Создать группу' })).toHaveCount(0);
  await create(page, 'Ученик');
  const dialog = page.getByRole('dialog', { name: 'Новый ученик', exact: true });
  const student = dialog.getByRole('button', { name: 'Ученик', exact: true });
  const group = dialog.getByRole('button', { name: 'Группа', exact: true });
  await expect(student).toBeFocused();
  await expect(student).toHaveCSS('outline-style', 'none');
  const gap = await dialog.evaluate((element) => {
    const choice = element.querySelector('tb-segment-group');
    const field = element.querySelector('.tb-field');
    if (!choice || !field) throw new Error('Missing creation choice/field');
    return field.getBoundingClientRect().top - choice.getBoundingClientRect().bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(16);
  await student.press('Tab');
  await expect(group).toBeFocused();
  await expect(group).toHaveCSS('outline-width', '3px');
  await dialog.getByLabel('Имя и фамилия').click();
  await expect(dialog.getByLabel('Имя и фамилия')).toHaveCSS('outline-style', 'none');
  await group.click();
  await expect(page.getByRole('dialog', { name: 'Новая группа', exact: true })).toBeVisible();
  await expect(dialog).toBeHidden();
});

test('payment headings and figures stay outside the scroll area and the report uses a pane', async ({
  page,
}) => {
  await page.goto('/teacher/billing');
  const pane = page.locator('tb-pane').first();
  await expect(pane.locator('.tb-pane__header .tb-ops-figure')).toHaveCount(4);
  await expect(pane.locator('.tb-pane__scroll tb-page-header')).toHaveCount(0);
  await expect(pane.locator('.tb-pane__header tb-filter-chips')).toBeVisible();
  await page.getByRole('link', { name: 'Отчёт за месяц', exact: true }).click();
  await expect(page.locator('tb-pane .tb-pane__header h1')).toHaveText('Отчёт за месяц');
  await expect(page.locator('tb-pane .tb-figures .tb-figure')).toHaveCount(3);
  await expect(page.locator('tb-pane .tb-pane__header #report-month')).toBeVisible();
});

test('notification width is independent of content and matches the medium drawer', async ({
  page,
}) => {
  await page.route('**/api/me/notifications/unread-count', (route) =>
    route.fulfill({ json: { count: 22 } }),
  );
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.goto('/teacher/billing');
  const bell = page.locator('tb-notification-bell').getByRole('button');
  await expect(bell).toHaveAccessibleName('Уведомления, непрочитанных: 22');
  await bell.click();
  const docked = page.locator('.tb-notifications-pane');
  await expect(docked).toHaveCSS('width', '400px');
  await docked.getByRole('tab', { name: 'Отправленные', exact: true }).click();
  await expect(docked).toHaveCSS('width', '400px');
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator('.tb-side-sheet--narrow')).toHaveCSS('width', '400px');
});
