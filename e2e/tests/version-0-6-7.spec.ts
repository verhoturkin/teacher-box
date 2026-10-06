import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.6.7: lists in cards are segmented lists (ADR-0020) — every row is a tile a tone lighter
 * than the card, 2 px from its neighbours, with an avatar or an icon; tables keep their columns but
 * their rows are the same tiles, and on a phone the card around them stays.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

async function signIn(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
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

  const card = page.locator('p-card').filter({ hasText: 'Нерабочее время' }).last();
  const rows = card.locator('ul.tb-list > li');
  await expect(rows.filter({ hasText: 'Обед 0.6.7' }).first()).toBeVisible();
  await expect(rows.first().locator('.tb-list__lead .pi-moon')).toHaveCount(1);

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
  expect(tile.top).toBe('16px');
  expect(await styleOf(page, 'ul.tb-list', 'row-gap')).toBe('2px');

  const count = await rows.count();
  expect(count).toBeGreaterThan(1);
  const first = await rows.nth(0).boundingBox();
  const second = await rows.nth(1).boundingBox();
  expect(Math.round((second?.y ?? 0) - ((first?.y ?? 0) + (first?.height ?? 0)))).toBe(2);
  expect(tile.bottom).toBe('4px');
});

test('a table keeps its columns, its rows are tiles with the initials', async ({ page }) => {
  await signIn(page);
  // students and groups are cards on every screen since 0.6.8 (ADR-0021): the payments keep columns
  await page.goto('/teacher/billing');

  const row = page
    .locator('.p-datatable.tb-cards tbody tr')
    .filter({ hasText: 'Плитка Проверкина' })
    .first();
  await expect(row.locator('.tb-avatar')).toHaveText('ПП');
  const cell = row.locator('td').first();
  expect(await cell.evaluate((element) => getComputedStyle(element).borderBottomWidth)).toBe('0px');
  expect(await cell.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
  await expect(page.locator('.p-datatable.tb-cards thead').first()).toBeVisible();
});

test('on a phone the card around a list stays and the rows are tiles on it', async ({ page }) => {
  await signIn(page, 390);
  await page.goto('/teacher/students');

  // 0.7.3: the students are a segmented list (tb-list), not a table
  const card = page.locator('.p-card:has(ul.tb-list[aria-label="Ученики"])').first();
  expect(await card.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
  const row = page
    .locator('ul.tb-list[aria-label="Ученики"] > li')
    .filter({ hasText: 'Плитка Проверкина' })
    .first();
  const background = await row.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  expect(background).not.toBe(
    await card.evaluate((element) => getComputedStyle(element).backgroundColor),
  );
});
