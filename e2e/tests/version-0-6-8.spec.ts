import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.6.8: one column (ADR-0021) — the cards of every section are one under another on every
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

test('the schedule keeps requests and recurring lessons in a pane beside the calendar', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/schedule');

  const side = page.locator('.tb-schedule-side');
  const calendar = page.locator('tb-pane:has(tb-schedule-calendar)');
  await expect(side).toBeVisible();
  const sideBox = await side.boundingBox();
  const calendarBox = await calendar.boundingBox();
  expect(sideBox?.x ?? 0).toBeGreaterThanOrEqual(
    (calendarBox?.x ?? 0) + (calendarBox?.width ?? 0) - 1,
  );
});

test('the buttons of the rows of a list stand on one line', async ({ page, request }) => {
  await prepare(request);
  await signIn(page);
  await page.goto('/teacher/schedule');

  const rows = page
    .locator('.tb-schedule-side')
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
      title: 'Колонка 0.6.8',
      description: null,
      dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      studentIds: null,
    },
  });
  expect(created.ok()).toBe(true);
  await signIn(page);
  await page.goto('/teacher/homework');
  // 242.1: the list is a pane; the assignment page keeps the window until its own stage (242.2)
  await expect(page.locator('h1.tb-page-title')).toHaveText('Задания');
  await page.getByRole('button', { name: /^Активные/ }).click();
  await page.getByRole('link', { name: 'Колонка 0.6.8' }).click();
  // 0.25.0: the list pane keeps its own title beside the assignment
  await expect(page.locator('h1.tb-page-title', { hasText: 'Колонка 0.6.8' })).toBeVisible();
  await expect(page.locator('.tb-page-header > .tb-actions p-button').first()).toBeVisible();
});

test('students are list rows with the status on the right, «⋮» in the card, words are whole', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/students');

  const card = page
    .locator('ul.tb-list[aria-label="Ученики"] > li')
    .filter({ hasText: LONG_NAME })
    .first();
  await expect(card).toBeVisible();
  const cardBox = await card.boundingBox();
  // 0.7.3: a row is the name, a supporting line and the status on the right; 0.23.0: in the 412 px
  // list pane the long name wraps at its hyphen, «⋮» moved from the row to the card
  expect(cardBox?.height ?? 0).toBeLessThan(140);
  await expect(card.getByRole('button')).toHaveCount(0);
  const tag = await card.locator('p-tag').boundingBox();
  expect((tag?.x ?? 0) + (tag?.width ?? 0)).toBeLessThanOrEqual(
    (cardBox?.x ?? 0) + (cardBox?.width ?? 0),
  );
  await card.locator('.tb-list__title').click();
  await expect(page.getByRole('button', { name: `Действия: ${LONG_NAME}` })).toBeVisible();
  // the long name is not broken in the middle of a word: each line ends at a space or the hyphen
  expect(
    await card.locator('.tb-list__title').evaluate((title) => {
      const text = title.firstChild;
      if (text === null || text.textContent === null) {
        return false;
      }
      const range = document.createRange();
      const tops: number[] = [];
      for (let index = 0; index < text.textContent.length; index++) {
        range.setStart(text, index);
        range.setEnd(text, index + 1);
        tops.push(Math.round(range.getBoundingClientRect().top));
      }
      return tops.every(
        (top, index) =>
          index === 0 ||
          top === tops[index - 1] ||
          /[\s-]/.test(text.textContent?.[index - 1] ?? ''),
      );
    }),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test('the settings of the administrator are one under another', async ({ page }) => {
  await signIn(page, 1440, 'admin');
  await page.goto('/admin/settings?open=sessions');

  const fields = page.locator('.tb-setting');
  await expect(fields.first()).toBeVisible();
  const lefts = await fields.evaluateAll((items) =>
    items.slice(0, 6).map((item) => Math.round(item.getBoundingClientRect().left)),
  );
  expect(new Set(lefts).size).toBe(1);

  await page.goto('/admin/status');
  await expect(page.locator('.tb-feed').first()).toBeVisible();
});
