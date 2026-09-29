import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';
import { laterThisWeek } from './this-week';

/**
 * Version 1.6.9: fixes of 1.6.8 (ADR-0021) — the notifications and the help are as wide as the
 * other sections, the contents of the help are above the article, and on a phone the buttons of an
 * upcoming lesson stay in one line: with a meeting the requests are in the «⋮» menu.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);

async function signIn(page: Page, login: string, password: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function teacherHeaders(request: APIRequestContext): Promise<Record<string, string>> {
  const login = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  const { accessToken } = (await login.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

/** A lesson start in «Ближайшие занятия» of the student: later this week, in Moscow. */
function upcomingStart(hours: number): string {
  const lesson = laterThisWeek(hours);
  const day = new Date(Date.now() + lesson.days * 86_400_000).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Moscow',
  });
  return `${day}T${String(lesson.hours).padStart(2, '0')}:00:00+03:00`;
}

/** A student who signed up, with a lesson this week and, if asked, a meeting link. */
async function studentWithLesson(
  request: APIRequestContext,
  name: string,
  hours: number,
  meeting: boolean,
): Promise<{ login: string; password: string }> {
  const headers = await teacherHeaders(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: name, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student, invite } = (await created.json()) as {
    student: { id: string };
    invite: { token: string };
  };
  const login = `${name.split(' ')[0]?.toLowerCase() ?? 'student'}-${RUN}`.replace(
    /[^a-z0-9-]/g,
    'x',
  );
  const password = `pass-${RUN}-secret`;
  expect(
    (
      await request.post(`/api/auth/invites/${invite.token}/accept`, { data: { login, password } })
    ).ok(),
  ).toBe(true);
  if (meeting) {
    const room = await request.put('/api/teacher/meetings/rooms', {
      headers,
      data: {
        studentId: student.id,
        groupId: null,
        joinUrl: 'https://telemost.yandex.ru/j/16900000000000',
      },
    });
    expect(room.ok()).toBe(true);
  }
  const lesson = await request.post('/api/teacher/schedule/lessons', {
    headers,
    data: {
      studentId: student.id,
      startsAt: upcomingStart(hours),
      durationMinutes: 60,
      allowOverlap: true,
    },
  });
  expect(lesson.ok()).toBe(true);
  return { login, password };
}

async function widthOfFirstCard(page: Page, path: string): Promise<number> {
  await page.goto(path);
  const card = page.locator('main .p-card, main tb-fold-card').first();
  await expect(card).toBeVisible();
  return Math.round((await card.boundingBox())?.width ?? 0);
}

/** The middles of the buttons of a row: one line means one middle. */
async function buttonMiddles(row: Locator): Promise<number[]> {
  return row.locator('.tb-list__trail :is(.p-button, a.p-button)').evaluateAll((buttons) =>
    buttons
      .filter((button) => button.getBoundingClientRect().width > 0)
      .map((button) => {
        const box = button.getBoundingClientRect();
        return Math.round(box.top + box.height / 2);
      }),
  );
}

test('the notifications and the help are as wide as the other sections', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1440);
  const schedule = await widthOfFirstCard(page, '/teacher/schedule');

  expect(await widthOfFirstCard(page, '/teacher/notifications')).toBe(schedule);
  expect(await widthOfFirstCard(page, '/teacher/help')).toBe(schedule);
});

test('the contents of the help are above the article', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1440);
  await page.goto('/teacher/help/groups');

  const contents = page.getByRole('navigation', { name: 'Статьи справки' });
  const current = contents.locator('a[aria-current="page"]');
  await expect(current).toHaveText('Группы');
  const title = page.locator('.tb-help__title');
  await expect(title).toHaveText('Группы');
  const contentsBox = await contents.boundingBox();
  const titleBox = await title.boundingBox();
  expect((contentsBox?.y ?? 0) + (contentsBox?.height ?? 0)).toBeLessThan(titleBox?.y ?? 0);

  await contents.getByRole('link', { name: 'Оплаты' }).click();
  await expect(page).toHaveURL(/\/teacher\/help\/billing$/);
  await expect(page.locator('.tb-help__title')).toHaveText('Оплаты');
});

test('on a phone the buttons of an upcoming lesson stay in one line', async ({ page, request }) => {
  const plain = await studentWithLesson(request, `Строка ${RUN}`, 20, false);
  await signIn(page, plain.login, plain.password, 360);
  await page.goto('/cabinet/schedule');

  const row = page.locator('ul.tb-list > li').first();
  await expect(row.getByRole('button', { name: 'Перенести' })).toBeVisible();
  const middles = await buttonMiddles(row);
  expect(middles).toHaveLength(2);
  expect(Math.abs((middles[0] ?? 0) - (middles[1] ?? -9))).toBeLessThanOrEqual(1);
});

test('on a phone a lesson with a meeting keeps the requests in the menu', async ({
  page,
  request,
}) => {
  const online = await studentWithLesson(request, `Меню ${RUN}`, 21, true);
  await signIn(page, online.login, online.password, 360);
  await page.goto('/cabinet/schedule');

  const row = page.locator('ul.tb-list > li').first();
  await expect(row.getByRole('link', { name: /Подключиться/ })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Перенести', exact: true })).toHaveCount(0);
  const middles = await buttonMiddles(row);
  expect(middles).toHaveLength(2);
  expect(Math.abs((middles[0] ?? 0) - (middles[1] ?? -9))).toBeLessThanOrEqual(1);

  await row.getByRole('button', { name: /^Перенести или отменить/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Отменить' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Перенести' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
