import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Version 1.6.8: one column (ADR-0021) — the cards of every section are one under another on every
 * screen, the buttons of the rows of a list stand on one line, the actions of the page header are
 * at one height on every page and words are not broken in the middle.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';
const LONG_NAME = 'Колонка Константинопольская-Преображенская';

async function signIn(page: Page, width = 1440, login = 'teacher'): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(login === 'admin' ? ADMIN_PASSWORD : TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function token(request: APIRequestContext): Promise<Record<string, string>> {
  const login = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  const { accessToken } = (await login.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

/** A student with a long name and two weekly series of lessons: two rows with the same buttons. */
async function prepare(request: APIRequestContext): Promise<void> {
  const headers = await token(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: LONG_NAME, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student } = (await created.json()) as { student: { id: string } };
  const startsOn = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  for (const [weekdays, startTime] of [
    [['MONDAY'], '07:00'],
    [['TUESDAY', 'WEDNESDAY', 'FRIDAY', 'SATURDAY'], '07:30'],
  ] as const) {
    const series = await request.post('/api/teacher/schedule/series', {
      headers,
      data: {
        studentId: student.id,
        weekdays,
        startTime,
        durationMinutes: 30,
        startsOn,
        allowOverlap: true,
      },
    });
    expect(series.ok()).toBe(true);
  }
}

/** The cards of the section: the outermost cards of the main area. */
function sectionCards(page: Page): Locator {
  return page.locator('main .p-card:not(.p-card .p-card), main tb-fold-card');
}

/** No card of the section has another card beside it. */
async function expectOneColumn(page: Page): Promise<void> {
  const boxes = await sectionCards(page).evaluateAll((cards) =>
    cards
      .map((card) => card.getBoundingClientRect())
      .filter((box) => box.width > 0)
      .map((box) => ({ left: box.left, right: box.right, top: box.top, bottom: box.bottom })),
  );
  expect(boxes.length).toBeGreaterThan(1);
  for (const box of boxes) {
    const beside = boxes.filter(
      (other) =>
        other !== box &&
        other.left >= box.right - 1 &&
        other.top < box.bottom &&
        other.bottom > box.top,
    );
    expect(beside).toHaveLength(0);
  }
}

test('the cards of every section are in one column', async ({ page }) => {
  await signIn(page);
  for (const path of ['/teacher', '/teacher/schedule', '/teacher/billing', '/teacher/help']) {
    await page.goto(path);
    await expect(page.locator('h1.tb-page-title')).toBeVisible();
    await expect(sectionCards(page).nth(1)).toBeVisible();
    await expectOneColumn(page);
  }

  // key figures are rows one under another: the name on the left, the figure on the right
  await page.goto('/teacher/billing');
  const figures = page.locator('.tb-stats .p-card');
  await expect(figures.first()).toBeVisible();
  const lefts = await figures.evaluateAll((cards) =>
    cards.map((card) => Math.round(card.getBoundingClientRect().left)),
  );
  expect(new Set(lefts).size).toBe(1);
});

test('the schedule puts what needs an answer above the calendar', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/schedule');

  const series = page.locator('p-card').filter({ hasText: 'Регулярные занятия' }).last();
  const calendar = page.locator('p-card:has(tb-schedule-calendar)');
  await expect(series).toBeVisible();
  const seriesBox = await series.boundingBox();
  const calendarBox = await calendar.boundingBox();
  expect(seriesBox?.y ?? 0).toBeGreaterThan((calendarBox?.y ?? 0) + (calendarBox?.height ?? 0));
  expect(Math.round(seriesBox?.x ?? 0)).toBe(Math.round(calendarBox?.x ?? 0));
});

test('the buttons of the rows of a list stand on one line', async ({ page, request }) => {
  await prepare(request);
  await signIn(page);
  await page.goto('/teacher/schedule');

  const rows = page
    .locator('p-card')
    .filter({ hasText: 'Регулярные занятия' })
    .last()
    .locator('ul.tb-list > li')
    .filter({ hasText: LONG_NAME });
  await expect(rows).toHaveCount(2);
  const edits = await rows.evaluateAll((items) =>
    items.map((item) =>
      Math.round(
        item.querySelector('.tb-list__trail .p-button')?.getBoundingClientRect().left ?? -1,
      ),
    ),
  );
  expect(edits[0]).toBeGreaterThan(0);
  expect(edits[1]).toBe(edits[0]);
  const texts = await rows.evaluateAll((items) =>
    items.map((item) => Math.round(item.querySelector('.tb-list__text')?.clientWidth ?? -1)),
  );
  expect(texts[1]).toBe(texts[0]);
});

test('the actions of the page header are at one height on every page', async ({
  page,
  request,
}) => {
  // an assignment with a due date: its page has a line of details under the title
  const created = await request.post('/api/teacher/homework/assignments', {
    headers: await token(request),
    data: {
      title: 'Колонка 1.6.8',
      description: null,
      dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      studentIds: null,
    },
  });
  expect(created.ok()).toBe(true);
  await signIn(page);
  await page.goto('/teacher/homework');
  const list = await page.locator('.tb-page-header > .tb-actions p-button').first().boundingBox();
  await page.getByRole('link', { name: 'Колонка 1.6.8' }).click();
  await expect(page.locator('h1.tb-page-title')).toHaveText('Колонка 1.6.8');
  const nested = await page.locator('.tb-page-header > .tb-actions p-button').first().boundingBox();
  expect(Math.round(nested?.y ?? 0)).toBe(Math.round(list?.y ?? -1));
});

test('students are cards with their buttons next to the name, words are whole', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/students');

  const card = page
    .locator('.p-datatable.tb-cards tbody tr')
    .filter({ hasText: LONG_NAME })
    .first();
  await expect(card).toBeVisible();
  await expect(page.locator('.p-datatable.tb-cards--wide thead').first()).toBeHidden();
  const cardBox = await card.boundingBox();
  const edit = await card
    .getByRole('button', { name: `Редактировать: ${LONG_NAME}` })
    .boundingBox();
  const name = await card.locator('.tb-list__title').boundingBox();
  // the button is inside the card, on the line of the name
  expect((edit?.x ?? 0) + (edit?.width ?? 0)).toBeLessThanOrEqual(
    (cardBox?.x ?? 0) + (cardBox?.width ?? 0),
  );
  expect(edit?.y ?? 0).toBeLessThan((name?.y ?? 0) + (name?.height ?? 0));
  // the long name takes one line: it is not broken in the middle of a word
  expect(
    await card
      .locator('.tb-list__title')
      .evaluate((title) => title.getClientRects().length === 1 && title.clientHeight < 40),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test('the settings of the administrator are one under another', async ({ page }) => {
  await signIn(page, 1440, 'admin');
  await page.goto('/admin/settings');

  const fields = page.locator('.tb-setting');
  await expect(fields.first()).toBeVisible();
  const lefts = await fields.evaluateAll((items) =>
    items.slice(0, 6).map((item) => Math.round(item.getBoundingClientRect().left)),
  );
  expect(new Set(lefts).size).toBe(1);

  await page.goto('/admin/status');
  await expect(page.locator('.tb-stats .p-card').first()).toBeVisible();
  await expectOneColumn(page);
});
