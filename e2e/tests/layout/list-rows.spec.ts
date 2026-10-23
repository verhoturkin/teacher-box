import { startSession } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.6.7: lists in cards are segmented lists (ADR-0020) — every row is a tile a tone lighter
 * than the card, 2 px from its neighbours, with an avatar or an icon; tables keep their columns but
 * their rows are the same tiles, and on a phone the card around them stays.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  // The mouse stays where «Войти» was: away from the lists, so no tile is hovered.
  await page.mouse.move(0, 0);
}

async function prepare(request: APIRequestContext): Promise<void> {
  const login = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const today = new Date().toISOString().slice(0, 10);
  for (const note of ['Обед 0.6.7', 'Выходные 0.6.7']) {
    const created = await request.post('/api/teacher/schedule/off-times', {
      headers,
      data: {
        kind: 'WEEKLY',
        startsAt: null,
        endsAt: null,
        weekdays: ['SUNDAY'],
        startTime: note.startsWith('Обед') ? '13:00' : '15:00',
        endTime: note.startsWith('Обед') ? '14:00' : '16:00',
        startsOn: today,
        endsOn: null,
        note,
      },
    });
    expect(created.ok()).toBe(true);
  }
  const student = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: 'Плитка Проверкина', email: null, phone: null, note: null },
  });
  expect(student.ok()).toBe(true);
}

function styleOf(page: Page, selector: string, property: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
}

test('rows of a list in a card are tiles with an icon, 2 px apart', async ({ page, request }) => {
  await prepare(request);
  await signIn(page);
  await page.goto('/teacher/schedule');

  // 0.24.0: off time is a tab of the side pane of the schedule
  const card = page
    .locator('.tb-schedule-side .tb-schedule-section')
    .filter({ has: page.getByRole('heading', { name: 'Нерабочее время', exact: true }) });
  const rows = card.locator('ul.tb-list > li');
  await expect(rows.filter({ hasText: 'Обед 0.6.7' }).first()).toBeVisible();
  await expect(rows.first().locator('.tb-list__lead .tb-i-dark_mode')).toHaveCount(1);

  const cardBackground = await card.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  const tile = await rows.first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      top: style.borderTopLeftRadius,
      bottom: style.borderBottomLeftRadius,
    };
  });
  expect(tile.background).not.toBe(cardBackground);
  expect(tile.background).not.toBe('rgba(0, 0, 0, 0)');
  // 0.24.1: no card around the list: the group's outer corner is the large 16 px, the inner ones 4 px
  expect(tile.top).toBe('16px');
  expect(await styleOf(page, 'ul.tb-list', 'row-gap')).toBe('2px');

  const count = await rows.count();
  expect(count).toBeGreaterThan(1);
  const first = await rows.nth(0).boundingBox();
  const second = await rows.nth(1).boundingBox();
  expect(Math.round((second?.y ?? 0) - ((first?.y ?? 0) + (first?.height ?? 0)))).toBe(2);
  expect(tile.bottom).toBe('4px');
});

test('the payments are a list like the students, its rows are tiles with the initials', async ({
  page,
}) => {
  await signIn(page);
  // 0.9.3: the students are a segmented list (tb-list), not a table (243.2: the balances list left the payments)
  await page.goto('/teacher/students');

  const row = page
    .locator('ul.tb-list[aria-label="Ученики"] > li')
    .filter({ hasText: 'Плитка Проверкина' })
    .first();
  await expect(row.locator('.tb-avatar')).toHaveText('ПП');
  expect(await row.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
  await expect(page.locator('.p-datatable')).toHaveCount(0);
});

test('on a phone the page lies on the window and the rows are tiles on it', async ({ page }) => {
  await signIn(page, 390);
  await page.goto('/teacher/students');

  // 0.7.3: the students are a segmented list (tb-list), not a table; 0.24.1: on a phone the list's pane is not a card
  // on the background: it has no surface of its own, the window is the surface
  const pane = page.locator('tb-pane:has(ul.tb-list[aria-label="Ученики"])').first();
  await expect(pane).toBeVisible();
  expect(await pane.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  const window = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const row = page
    .locator('ul.tb-list[aria-label="Ученики"] > li')
    .filter({ hasText: 'Плитка Проверкина' })
    .first();
  const background = await row.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  expect(background).not.toBe(window);
});
