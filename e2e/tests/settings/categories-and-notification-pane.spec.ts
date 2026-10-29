import { startSession, bearer } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.22.0, settings and the bell: the settings are list-detail with eight categories (the list and the
 * category side by side on a wide screen, one at a time on a phone); the notifications are the bell's side
 * sheet — the third pane on extra-large, the whole screen on a phone; the old addresses of the Calls, AI,
 * account and Notifications pages and the settings' `?open=` lead to their new place; the student's messengers
 * are in «Мой аккаунт».
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const LOGIN = `bell-${RUN}`;
const PASSWORD = 'student-pass-1';
const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1920, height: 1080 };
const CATEGORIES = [
  'Мой аккаунт',
  'Портал',
  'Расписание и календарь',
  'Звонки',
  'Уведомления и мессенджеры',
  'Оплаты',
  'ИИ-помощник',
  'Данные',
];

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

function bell(page: Page) {
  return page.locator('tb-notification-bell').getByRole('button');
}

for (const viewport of [WIDE, PHONE]) {
  test(`notifications scroll inside the tab at ${String(viewport.width)}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await signIn(page, 'teacher', TEACHER_PASSWORD);
    await page.route('**/api/me/notifications?*', async (route) => {
      const items = Array.from({ length: 20 }, (_, index) => ({
        id: `scroll-${String(index)}`,
        kind: 'HOMEWORK_ASSIGNED',
        title: `Уведомление ${String(index + 1)}`,
        body: 'Достаточно длинный текст уведомления для проверки прокрутки внутри вкладки.',
        link: null,
        read: false,
        createdAt: '2026-10-24T10:00:00Z',
      }));
      await route.fulfill({ json: { items, total: items.length, unread: items.length } });
    });
    await page.goto('/teacher/students');
    await bell(page).click();
    const container =
      viewport.width === WIDE.width
        ? page.locator('#tb-notifications-sheet')
        : page.getByRole('dialog', { name: 'Уведомления' });
    const tab = container.getByRole('tab', { name: /^Входящие/ });
    const title = container.getByText('Уведомления', { exact: true });
    const scroll = container.locator('.tb-notifications-scroll');
    await expect(container.getByText('Уведомление 20', { exact: true })).toBeAttached();
    const beforeTab = await tab.boundingBox();
    const beforeTitle = await title.boundingBox();
    await scroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    // The opening spring moves the sheet horizontally; scrolling must keep its vertical anchors.
    expect((await tab.boundingBox())?.y).toBe(beforeTab?.y);
    expect((await title.boundingBox())?.y).toBe(beforeTitle?.y);
    await expect(container.getByText('Уведомление 20', { exact: true })).toBeInViewport();
  });
}

test('the settings list the eight categories beside the chosen one at 1920, one at a time at 390', async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/settings');
  const list = page.getByRole('navigation', { name: 'Категории настроек' });
  await expect(list.getByRole('link')).toHaveText(CATEGORIES.map((name) => new RegExp(name)));
  // the first category is open beside the list
  await expect(page.getByRole('region', { name: 'Мой аккаунт' })).toBeVisible();

  await list.getByRole('link', { name: /Оплаты/ }).click();
  await expect(page).toHaveURL(/\/teacher\/settings\/payments$/);
  await expect(page.getByRole('region', { name: 'Оплаты' })).toBeVisible();
  await expect(list).toBeVisible();

  await page.setViewportSize(PHONE);
  await page.goto('/teacher/settings');
  await expect(list).toBeVisible();
  await expect(page.getByRole('region', { name: 'Мой аккаунт' })).toHaveCount(0);
  await list.getByRole('link', { name: /Данные/ }).click();
  await expect(page).toHaveURL(/\/teacher\/settings\/data$/);
  await expect(list).toHaveCount(0);
  await page.getByRole('link', { name: 'Все настройки' }).click();
  await expect(page).toHaveURL(/\/teacher\/settings$/);
  await expect(list).toBeVisible();
});

test('the old addresses lead to the settings categories and the bell', async ({ page }) => {
  await page.setViewportSize(WIDE);
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  const redirects: readonly (readonly [string, RegExp])[] = [
    ['/teacher/calls', /\/teacher\/settings\/calls$/],
    ['/teacher/ai', /\/teacher\/settings\/ai$/],
    ['/teacher/account', /\/teacher\/settings\/account$/],
    ['/teacher/settings?open=data', /\/teacher\/settings\/data$/],
    ['/teacher/settings?open=meetings', /\/teacher\/settings\/calls$/],
    ['/teacher/settings?open=portal', /\/teacher\/settings\/portal$/],
    ['/teacher/notifications?open=messengers', /\/teacher\/settings\/messengers$/],
  ];
  for (const [old, now] of redirects) {
    await page.goto(old);
    await expect(page).toHaveURL(now);
  }

  // the Notifications section is gone: its address opens the bell's sheet at home
  await page.goto('/teacher/notifications');
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.locator('#tb-notifications-sheet')).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Входящие/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(
    page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Уведомления' }),
  ).toHaveCount(0);
});

test('the bell is a pane that stays across pages at 1920 and a full-screen sheet at 390', async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/students');

  await bell(page).click();
  const pane = page.locator('#tb-notifications-sheet');
  await expect(pane).toBeVisible();
  await expect(bell(page)).toHaveAttribute('aria-expanded', 'true');
  // non-modal: no dialog, the page stays usable and the pane stays across pages
  await expect(page.getByRole('dialog', { name: 'Уведомления' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Отправленные' }).click();
  await expect(pane.getByRole('button', { name: 'Написать ученикам' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Задания' })
    .click();
  await expect(page).toHaveURL(/\/teacher\/homework/);
  await expect(pane).toBeVisible();
  const main = await page.locator('main').boundingBox();
  const box = await pane.boundingBox();
  expect(main && box && box.x >= main.x + main.width - 1).toBeTruthy();

  await pane.focus();
  await page.keyboard.press('Escape');
  await expect(pane).toBeHidden();
  await expect(bell(page)).toBeFocused();

  await page.setViewportSize(PHONE);
  await page.goto('/teacher');
  await bell(page).click();
  const sheet = page.getByRole('dialog', { name: 'Уведомления' });
  await expect(sheet).toBeVisible();
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox && sheetBox.width >= PHONE.width - 1).toBeTruthy();
});

test('the student: the old notifications address opens the bell, the messengers are in «Мой аккаунт»', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/teacher/students', {
    headers: await bearer(request),
    data: { displayName: `Ученик с колокольчиком ${RUN}`, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { invite } = (await created.json()) as { invite: { token: string } };
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login: LOGIN, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);

  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, LOGIN, PASSWORD);
  await page.goto('/cabinet/notifications');
  await expect(page).toHaveURL(/\/cabinet$/);
  const sheet = page.getByRole('dialog', { name: 'Уведомления' });
  await expect(sheet).toBeVisible();
  // the student has the inbox only, no tabs
  await expect(sheet.getByRole('tab')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto('/cabinet/account');
  await expect(page.locator('tb-channels-panel')).toBeVisible();
  await expect(page.getByText('Что присылать в мессенджеры')).toBeVisible();
});
