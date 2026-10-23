import { expect, test, type Locator, type Page } from '@playwright/test';
import { bearer, startSession } from '../support/session';

const PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const LOGIN = `compact${Date.now().toString(36)}`;
const STUDENT_PASSWORD = 'compact-test-pass';
let studentId = '';

async function fits(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  expect(
    await locator.evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(1);
  await expect(locator).toHaveCSS('overflow-y', 'visible');
}

function lesson() {
  const start = new Date();
  start.setUTCHours(9, 0, 0, 0);
  return {
    id: 'compact-lesson',
    studentId,
    studentName: 'Проверка мобильного кабинета',
    studentAvatar: null,
    groupId: null,
    groupName: null,
    participants: [],
    seriesId: null,
    version: 0,
    repeatWeeks: 0,
    repeatUntil: null,
    repeatVersion: null,
    occurrenceDate: null,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 3600000).toISOString(),
    durationMinutes: 60,
    topic: 'Тема занятия',
    meetingUrl: null,
    joinUrl: 'https://example.org/lesson',
    status: 'SCHEDULED',
    cancelledBy: null,
    cancelReason: null,
    originalStartsAt: null,
    pendingRequests: [],
  };
}

async function student(page: Page): Promise<void> {
  await startSession(page, LOGIN, STUDENT_PASSWORD);
}

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  const response = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: 'Проверка мобильного кабинета', email: null, phone: null, note: null },
  });
  expect(response.ok()).toBe(true);
  const created = (await response.json()) as { student: { id: string }; invite: { token: string } };
  studentId = created.student.id;
  const accepted = await request.post(`/api/auth/invites/${created.invite.token}/accept`, {
    data: { login: LOGIN, password: STUDENT_PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
});

test('teacher compact home retains today and week cards without briefing; roster omits total', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/teacher/schedule/summary', (route) =>
    route.fulfill({
      json: {
        today: [lesson()],
        next: lesson(),
        weekLessons: 1,
        unmarked: 0,
        weekConducted: 1,
        weekMissed: 0,
        pendingRequests: 0,
        hasLessons: true,
      },
    }),
  );
  await startSession(page, 'teacher', PASSWORD);
  await page.goto('/teacher');
  await expect(page.locator('tb-today-lessons')).toBeVisible();
  await expect(page.locator('tb-week-figures')).toBeVisible();
  await expect(page.locator('tb-page-header [meta]')).toHaveCount(0);
  await page.goto('/teacher/students');
  await expect(page.locator('tb-students-page tb-page-header [meta]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Разделы', exact: true }).click();
  await expect(
    page.locator('.tb-modal-rail .tb-side-nav__brand, .p-drawer .tb-side-nav__brand').last(),
  ).toHaveCSS('font-size', '22px');
});

test('teacher calendar chips switch the actual week and month views', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startSession(page, 'teacher', PASSWORD);
  await page.goto('/teacher/schedule');
  const screens = page.getByRole('group', { name: 'Разделы расписания', exact: true });
  await screens.getByRole('button', { name: 'Неделя', exact: true }).click();
  await expect(
    page.getByRole('rowheader', { name: 'Занятия по времени', exact: true }),
  ).toBeVisible();
  await screens.getByRole('button', { name: 'Месяц', exact: true }).click();
  await expect.poll(() => page.getByRole('grid').getByRole('row').count()).toBeGreaterThan(4);
  await expect(
    page.getByRole('rowheader', { name: 'Занятия по времени', exact: true }),
  ).toHaveCount(0);
  await screens.getByRole('button', { name: 'Неделя', exact: true }).click();
  await expect(
    page.getByRole('rowheader', { name: 'Занятия по времени', exact: true }),
  ).toBeVisible();
  await screens.getByRole('button', { name: 'Повестка', exact: true }).click();
  await expect(page.locator('tb-schedule-agenda')).toBeVisible();
});

test('compact payment figures and filters fit both cabinets; teacher report opens selected month', async ({
  page,
}) => {
  await startSession(page, 'teacher', PASSWORD);
  await page.route('**/api/teacher/billing/operations?*', (route) =>
    route.fulfill({
      json: {
        month: '2026-10',
        currency: 'RUB',
        operations: [
          {
            id: 'long-operation',
            kind: 'LESSON',
            studentId,
            studentName: 'Очень длинное имя ученика для проверки переносов',
            studentAvatar: null,
            date: '2026-10-20',
            amount: 0,
            status: 'CANCELLED',
            note: 'Очень длинная тема отменённого занятия без списания',
            voided: true,
            createdAt: '2026-10-20T10:00:00Z',
          },
        ],
      },
    }),
  );
  for (const width of [320, 390, 599]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/teacher/billing');
    await fits(page.locator('.tb-ops-figures'));
    await fits(page.locator('.tb-ops__filters tb-filter-chips'));
    await fits(page.locator('.tb-ops__list > li').first());
  }
  await page.getByRole('button', { name: 'Предыдущий месяц', exact: true }).click();
  const report = page.getByRole('link', { name: 'Отчёт за месяц', exact: true });
  const href = await report.getAttribute('href');
  await report.click();
  await expect(page).toHaveURL(
    new RegExp(`/teacher/billing/report[?]month=${href?.split('month=')[1] ?? ''}`),
  );
  await expect(page.locator('tb-monthly-report-page')).toBeVisible();
  await page.locator('#report-month').click();
  await expect(page.locator('.p-datepicker-panel')).toBeVisible();
  await student(page);
  for (const width of [320, 390, 599]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/cabinet/billing');
    await fits(page.locator('.tb-my-billing-figures'));
    await fits(page.locator('.tb-my-billing-history__bar tb-filter-chips'));
  }
});

test('homework search stays visible and student status tags stack vertically', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startSession(page, 'teacher', PASSWORD);
  await page.goto('/teacher/homework');
  await expect(page.locator('input[type="search"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Скрыть поиск', exact: true })).toHaveCount(0);
  await page.route('**/api/me/homework', (route) =>
    route.fulfill({
      json: [
        {
          taskId: 'compact-task',
          assignmentId: 'compact-assignment',
          title: 'Длинное название задания на телефоне',
          dueAt: '2026-10-01T10:00:00Z',
          status: 'ASSIGNED',
          grade: null,
          overdue: true,
          reviewedAt: null,
        },
      ],
    }),
  );
  await student(page);
  await page.goto('/cabinet/homework');
  await expect(page.locator('input[type="search"]')).toBeVisible();
  const tags = page.locator('tb-task-status p-tag');
  await expect(tags).toHaveCount(2);
  const first = await tags.nth(0).boundingBox();
  const second = await tags.nth(1).boundingBox();
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
  await fits(page.locator('.tb-list > li').first());
});

test('notification header keeps read-all beside close and uses compact corners and insets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/me/notifications/unread-count', (route) =>
    route.fulfill({ json: { count: 1 } }),
  );
  await page.route('**/api/me/notifications?*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'compact-notification',
            kind: 'HOMEWORK_ASSIGNED',
            title: 'Новое задание',
            body: 'Текст уведомления',
            link: null,
            createdAt: '2026-10-23T10:00:00Z',
            read: false,
          },
        ],
        total: 1,
        unread: 1,
      },
    }),
  );
  await student(page);
  await page.getByRole('button', { name: /Уведомления/ }).click();
  const sheet = page.locator('.tb-notifications-modal');
  await expect(sheet).toHaveCSS('border-top-left-radius', '28px');
  const readAll = sheet.getByRole('button', { name: 'Прочитать все', exact: true });
  const close = sheet.locator('.p-drawer-close-button');
  await expect(
    sheet.locator('.p-drawer-header').getByRole('button', { name: 'Прочитать все' }),
  ).toBeVisible();
  const left = await readAll.boundingBox();
  const right = await close.boundingBox();
  expect(left!.x).toBeLessThan(right!.x);
  expect(Math.abs(left!.y - right!.y)).toBeLessThanOrEqual(4);
  await expect(sheet.locator('.tb-notification__dot')).toHaveCount(0);
  await expect
    .poll(() =>
      sheet
        .locator('.tb-notifications')
        .evaluate((element) => Math.round(element.getBoundingClientRect().left)),
    )
    .toBe(16);
});

test('student calendar details adapt and upcoming sections stay contained on compact', async ({
  page,
}) => {
  const morning = new Date();
  morning.setUTCHours(8, 0, 0, 0);
  await page.clock.setFixedTime(morning);
  await page.route('**/api/me/schedule/lessons?*', (route) => route.fulfill({ json: [lesson()] }));
  await student(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/cabinet/schedule');
  await page
    .locator('tb-schedule-calendar')
    .getByText('Тема занятия', { exact: true })
    .first()
    .click();
  await expect(page.locator('.p-drawer.tb-side-sheet')).toBeVisible();
  await expect(page.locator('.p-drawer.tb-sheet')).toHaveCount(0);
  await page.locator('.p-drawer-close-button').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.tb-my-schedule-section').first()).toHaveCSS('border-radius', '16px');
  const day = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  }).format(new Date(lesson().startsAt));
  await page.getByRole('button', { name: day, exact: true }).click();
  await page.locator('.tb-agenda__row').first().click();
  await expect(page.locator('.p-drawer.tb-sheet')).toBeVisible();
  await page.locator('.p-drawer.tb-sheet').evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  await page.screenshot({ path: 'test-results/compact-cabinet.png', fullPage: true });
});
