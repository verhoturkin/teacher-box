import { startSession } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.15.1: the student's side as the teacher's — the nearest lesson card after the sketch (a time tile, no
 * visible title, «Войти в урок» at the end), homework in «Активные» / «Выполненные» with a search, the answered
 * requests folded under «Решённые», the «Мой аккаунт» fields across their cards.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик карточек ${RUN}`;
const LOGIN = `cards-${RUN}`;
const PASSWORD = `cards-pass-${RUN}`;
const HOMEWORK = `Домашнее ${RUN}`;

test.describe.configure({ mode: 'serial' });

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
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    ...(data === undefined ? {} : { data }),
  });
  expect(response.ok(), `${method} ${path}: ${String(response.status())}`).toBe(true);
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startSession(page, LOGIN, PASSWORD);
  await expect(page).toHaveURL(/\/cabinet$/);
}

/** At hours from now, on a whole minute. */
function inHours(hours: number): string {
  const date = new Date(Date.now() + hours * 3_600_000);
  date.setSeconds(0, 0);
  return date.toISOString();
}

test.beforeAll(async ({ request }) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const created = await api<{ student: { id: string }; invite: { token: string } }>(
    request,
    teacher,
    'POST',
    '/api/teacher/students',
    { displayName: STUDENT, email: null, phone: null, note: null },
  );
  const studentId = created.student.id;
  await api(request, teacher, 'POST', `/api/auth/invites/${created.invite.token}/accept`, {
    login: LOGIN,
    password: PASSWORD,
  });
  await api(request, teacher, 'PUT', '/api/teacher/meetings/rooms', {
    studentId,
    groupId: null,
    joinUrl: 'https://telemost.yandex.ru/j/11112222333344',
  });

  // the nearest lesson runs now; two later ones get requests
  const lesson = (startsAt: string): Promise<{ id: string }> =>
    api(request, teacher, 'POST', '/api/teacher/schedule/lessons', {
      studentId,
      startsAt,
      durationMinutes: 60,
      topic: 'Present Perfect',
      allowOverlap: true,
    });
  await lesson(inHours(-0.25));
  const later = await lesson(inHours(48));
  const latest = await lesson(inHours(72));

  await api(request, teacher, 'POST', '/api/teacher/homework/assignments', {
    title: HOMEWORK,
    description: 'Упражнения',
    studentIds: [studentId],
  });

  const student = await bearer(request, LOGIN, PASSWORD);
  await api(request, student, 'POST', `/api/me/schedule/lessons/${later.id}/requests`, {
    kind: 'RESCHEDULE',
    proposedStartsAt: inHours(50),
    comment: null,
  });
  const declined = await api<{ id: string }>(
    request,
    student,
    'POST',
    `/api/me/schedule/lessons/${latest.id}/requests`,
    { kind: 'CANCEL', proposedStartsAt: null, comment: 'Заболел' },
  );
  await api(request, teacher, 'POST', `/api/teacher/schedule/requests/${declined.id}/decline`, {
    answer: 'Проведём онлайн',
  });
});

test('the nearest lesson of the student is a calendar event like the teacher’s', async ({
  page,
}) => {
  await signIn(page);
  const hero = page.locator('.p-card.tb-hero');
  await expect(hero.locator('tb-lesson-time-tile')).toContainText('Идёт сейчас');
  await expect(hero).toContainText('Present Perfect');
  await expect(hero.getByRole('heading', { name: 'Ближайшее занятие' })).toHaveClass(/tb-sr-only/);
  // a running lesson: only the lesson link, no requests
  await expect(hero.getByText('Войти в урок')).toBeVisible();
  await expect(hero.getByRole('button', { name: 'Перенести' })).toHaveCount(0);
});

test('the student’s homework is filtered to hand in, in review and done, with a search', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/cabinet/homework');
  const filters = page.getByRole('group', { name: 'Что показать' });
  await expect(filters.getByRole('button', { name: /^Сдать/ })).toBeVisible();
  await expect(filters.getByRole('button', { name: /^На проверке/ })).toBeVisible();
  await expect(filters.getByRole('button', { name: /^Готовые/ })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Название задания' });
  await search.fill(RUN);
  await expect(page.getByRole('link', { name: HOMEWORK })).toBeVisible();
  await search.fill(`нет такого ${RUN}`);
  await expect(page.getByText('Ничего не найдено')).toBeVisible();
});

test('the answered requests are folded under «Решённые»', async ({ page }) => {
  await signIn(page);
  await page.goto('/cabinet/schedule');
  await expect(page.getByText('Ждёт ответа').first()).toBeVisible();
  const resolved = page.getByRole('button', { name: 'Решённые: 1' });
  await expect(resolved).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Учитель: Проведём онлайн')).toHaveCount(0);

  await resolved.click();
  await expect(resolved).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Учитель: Проведём онлайн')).toBeVisible();
});

test('the account fields take the width of their cards', async ({ page }) => {
  await signIn(page);
  await page.goto('/cabinet/account');
  const field = page.locator('#account-own-name');
  const card = page.locator('p-card', { has: field });
  const [fieldBox, cardBox] = [await field.boundingBox(), await card.boundingBox()];
  expect(fieldBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  // only the card's padding is left at the sides
  expect((cardBox?.width ?? 0) - (fieldBox?.width ?? 0)).toBeLessThan(64);
});

test('the student’s messengers and what to send are in «Мой аккаунт» (0.22.0)', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/cabinet/account');
  await expect(page.locator('tb-channels-panel')).toContainText('Мессенджеры');
  await expect(page.locator('tb-preferences-panel')).toContainText('Что присылать в мессенджеры');
  // the rail has no «Уведомления»: the notifications are in the bell
  await expect(
    page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Уведомления' }),
  ).toHaveCount(0);
});
