import { type APIRequestContext, type Locator, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.15.3: the student's home without the calls and boards cards, the nearest lesson with its boards as
 * chips; the teacher's home without «Сегодня»; notifications without icons, read by a swipe on a phone; labelled
 * buttons of past lessons (a bottom sheet on a phone); «⋮» for recurring lessons; boards in «Доски на портале» and
 * «Внешние доски», a tap on a row opens the board.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик 0.15.3 ${RUN}`;
const LOGIN = `calm-${RUN}`;
const PASSWORD = `calm-pass-${RUN}`;
const BOARD = `Доска 0.15.3 ${RUN}`;
const LINK_BOARD = `Холст 0.15.3 ${RUN}`;
const HOMEWORK = `Задание 0.15.3 ${RUN}`;
const PHONE = 390;

test.describe.configure({ mode: 'serial' });

let boardId = '';

async function bearer(
  request: APIRequestContext,
  login: string,
  password: string,
): Promise<string> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

async function api<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.post(path, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `POST ${path}: ${String(response.status())}`).toBe(true);
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

async function signIn(page: Page, login: string, password: string, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.locator('#login').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A finger swipe sideways over a row: touch pointer events, as a phone sends them. */
async function swipe(row: Locator): Promise<void> {
  const box = await row.boundingBox();
  expect(box).not.toBeNull();
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  const start = (box?.x ?? 0) + (box?.width ?? 0) * 0.8;
  const touch = { pointerType: 'touch', pointerId: 7, isPrimary: true, bubbles: true };
  await row.dispatchEvent('pointerdown', { ...touch, clientX: start, clientY: y });
  for (const step of [20, 80, 160, 240]) {
    await row.dispatchEvent('pointermove', { ...touch, clientX: start - step, clientY: y });
  }
  await row.dispatchEvent('pointerup', { ...touch, clientX: start - 240, clientY: y });
}

test.beforeAll(async ({ request }) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const created = await api<{ student: { id: string }; invite: { token: string } }>(
    request,
    teacher,
    '/api/teacher/students',
    { displayName: STUDENT, email: null, phone: null, note: null },
  );
  const studentId = created.student.id;
  await api(request, teacher, `/api/auth/invites/${created.invite.token}/accept`, {
    login: LOGIN,
    password: PASSWORD,
  });
  ({ id: boardId } = await api<{ id: string }>(request, teacher, '/api/teacher/boards', {
    kind: 'EXCALIDRAW',
    title: BOARD,
    url: null,
    studentIds: [studentId],
    groupIds: [],
  }));
  await api(request, teacher, '/api/teacher/boards', {
    kind: 'LINK',
    title: LINK_BOARD,
    url: 'https://app.holst.so/board/e2e-0-15-3',
    studentIds: [studentId],
    groupIds: [],
  });
  // the student's only lesson ahead: their nearest one; one in the past waits for a mark
  await api(request, teacher, '/api/teacher/schedule/lessons', {
    studentId,
    startsAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    durationMinutes: 60,
    allowOverlap: true,
  });
  await api(request, teacher, '/api/teacher/schedule/lessons', {
    studentId,
    startsAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    durationMinutes: 60,
    allowOverlap: true,
  });
  await api(request, teacher, '/api/teacher/schedule/series', {
    studentId,
    groupId: null,
    weekdays: ['SUNDAY'],
    startTime: '08:00',
    durationMinutes: 60,
    intervalWeeks: 1,
    startsOn: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    endsOn: null,
    topic: null,
    meetingUrl: null,
    allowOverlap: true,
  });
  // a new task: an unread notification of the student
  await api(request, teacher, '/api/teacher/homework/assignments', {
    title: HOMEWORK,
    description: 'Упражнения',
    studentIds: [studentId],
  });
});

test('the student’s home: no calls and boards cards, the boards of the lesson as chips', async ({
  page,
}) => {
  await signIn(page, LOGIN, PASSWORD);
  await expect(page.locator('tb-next-lesson-widget')).toBeVisible();
  await expect(page.locator('tb-my-calls-card')).toHaveCount(0);
  await expect(page.locator('tb-my-boards-card')).toHaveCount(0);

  const hero = page.locator('.p-card.tb-hero');
  await expect(hero.locator('a.tb-board-chip', { hasText: LINK_BOARD })).toHaveAttribute(
    'href',
    'https://app.holst.so/board/e2e-0-15-3',
  );
  await hero.locator('a.tb-board-chip', { hasText: BOARD }).click();
  await expect(page).toHaveURL(new RegExp(`/cabinet/boards/${boardId}$`));
});

test('the student’s boards are in two cards, a tap on a row opens the board', async ({ page }) => {
  await signIn(page, LOGIN, PASSWORD, PHONE);
  await page.goto('/cabinet/boards');
  await expect(page.getByRole('list', { name: 'Внешние доски' })).toContainText(LINK_BOARD);
  const row = page.getByRole('list', { name: 'Доски на портале' }).locator('li', {
    hasText: BOARD,
  });
  // the far end of the row, away from the title
  const box = await row.boundingBox();
  await page.mouse.click(
    (box?.x ?? 0) + (box?.width ?? 0) - 12,
    (box?.y ?? 0) + (box?.height ?? 0) - 8,
  );
  await expect(page).toHaveURL(new RegExp(`/cabinet/boards/${boardId}$`));
});

test('notifications have no icons, a swipe on a phone marks one read', async ({ page }) => {
  await signIn(page, LOGIN, PASSWORD, PHONE);
  const unread = page.locator('ul[aria-label="Непрочитанные"] > li');
  const row = unread.filter({ hasText: HOMEWORK });
  // the notification of the task comes from an event: wait for it, opening the bell's sheet again (0.22.0)
  await expect(async () => {
    await page.goto('/cabinet/notifications');
    await expect(row).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await expect(page.locator('tb-notification-list .tb-list__lead')).toHaveCount(0);

  await swipe(row);
  await expect(row).toHaveCount(0);
});

test('the teacher’s home has no «Сегодня»', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await expect(page.locator('tb-upcoming-lesson-widget')).toBeVisible();
  await expect(page.locator('tb-today-lessons-widget')).toHaveCount(0);
});

test('a past lesson is outlined, recurring lessons have a «⋮» menu', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  // 0.24.0: a past lesson is outlined in the calendar (the queue of Today shows only the first rows)
  await page.goto('/teacher/schedule');
  await expect(page.locator('.tb-lesson--unmarked', { hasText: STUDENT })).toBeVisible();
  await page.getByRole('button', { name: `Действия: ${STUDENT}` }).click();
  await expect(page.getByRole('menuitem', { name: 'Изменить' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Завершить…' })).toBeVisible();
  await page.keyboard.press('Escape');
});

test('on a phone a past lesson has its buttons under the row of the agenda', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, PHONE);
  await page.goto('/teacher/schedule');
  // 0.24.0: the agenda marks the lesson under its row, no bottom sheet
  await page.getByRole('button', { name: `Проведено: ${STUDENT}` }).click();
  await expect(page.getByRole('button', { name: `Проведено: ${STUDENT}` })).toHaveCount(0);
});

test('the teacher’s boards are cards, a tap anywhere on a card opens the board', async ({
  page,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  // 0.26.0: «Материалы» — one feed of cards; the title link covers the card
  await page.goto('/teacher/boards');
  const feed = page.getByRole('list', { name: 'Список досок' });
  await expect(feed).toContainText(BOARD);
  await expect(feed).toContainText(LINK_BOARD);
  const supporting = feed
    .locator('li', { hasText: BOARD })
    .locator('.tb-material-card__supporting');
  const box = await supporting.boundingBox();
  await page.mouse.click((box?.x ?? 0) + 4, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  await expect(page).toHaveURL(new RegExp(`/teacher/boards/${boardId}$`));
});
