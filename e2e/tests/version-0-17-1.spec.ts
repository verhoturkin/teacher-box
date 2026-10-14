import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.17.1 (ADR-0045): the one large button of the portal — «Войти в урок» / «Начать урок» in the home hero
 * is the M3E medium button (56 px, 24 px sides, a 24 px icon); the request buttons next to it stay 40 px.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const LOGIN = `hero-${RUN}`;
const PASSWORD = `hero-pass-${RUN}`;

test.describe.configure({ mode: 'serial' });

async function api<T>(
  request: APIRequestContext,
  token: string,
  method: 'POST' | 'PUT',
  path: string,
  data: unknown,
): Promise<T> {
  const response = await request.fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${method} ${path}: ${String(response.status())}`).toBe(true);
  const text = await response.text();
  return (text === '' ? undefined : JSON.parse(text)) as T;
}

async function signIn(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.locator('#login').fill(LOGIN);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/cabinet$/);
}

test.beforeAll(async ({ request }) => {
  const login = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(login.ok()).toBe(true);
  const teacher = ((await login.json()) as { accessToken: string }).accessToken;
  const created = await api<{ student: { id: string }; invite: { token: string } }>(
    request,
    teacher,
    'POST',
    '/api/teacher/students',
    { displayName: `Ученик героя ${RUN}`, email: null, phone: null, note: null },
  );
  const studentId = created.student.id;
  await api(request, teacher, 'POST', `/api/auth/invites/${created.invite.token}/accept`, {
    login: LOGIN,
    password: PASSWORD,
  });
  await api(request, teacher, 'PUT', '/api/teacher/meetings/rooms', {
    studentId,
    groupId: null,
    joinUrl: 'https://telemost.yandex.ru/j/17117117117117',
  });
  const startsAt = new Date(Date.now() + 2 * 3_600_000);
  startsAt.setSeconds(0, 0);
  await api(request, teacher, 'POST', '/api/teacher/schedule/lessons', {
    studentId,
    startsAt: startsAt.toISOString(),
    durationMinutes: 60,
    topic: 'Герой',
    allowOverlap: true,
  });
});

for (const width of [1280, 360]) {
  test(`the hero lesson button is 56 px, the requests 40 px (${String(width)} px)`, async ({
    page,
  }) => {
    await signIn(page, width);
    const hero = page.locator('.p-card.tb-hero');
    const join = hero.getByRole('link', { name: /Войти в урок/ });
    await expect(join).toBeVisible();
    await expect(join).toHaveClass(/tb-button-m/);
    const look = await join.evaluate((node) => ({
      height: Math.round(node.getBoundingClientRect().height),
      padding: getComputedStyle(node).paddingInlineStart,
      icon: getComputedStyle(node.querySelector('.p-button-icon, [class*="pi-"]') ?? node).fontSize,
    }));
    expect(look).toEqual({ height: 56, padding: '24px', icon: '24px' });

    const reschedule = hero.getByRole('button', { name: 'Перенести' });
    await expect(reschedule).toBeVisible();
    expect(Math.round((await reschedule.boundingBox())?.height ?? 0)).toBe(40);
    await expect(page.locator('.tb-button-m')).toHaveCount(1);
  });
}
