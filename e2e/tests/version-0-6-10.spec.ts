import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { laterThisWeek } from './this-week';

/**
 * Version 0.6.10: Material 3 Expressive (ADR-0022) — fields 56 px with the label on the outline,
 * the search bar, Expressive menus, «Начать урок» as a split button with the browser in its menu,
 * and on a phone the actions of an upcoming lesson in its bottom sheet.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const MEETING = 'https://telemost.yandex.ru/j/16100000000000';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

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

/** A lesson going on now: in «Сегодня» of the teacher (a few minutes after midnight: soon). */
function ongoingStart(): string {
  const moscow = new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/Moscow' });
  const minutes = Number(moscow.slice(0, 2)) * 60 + Number(moscow.slice(3, 5));
  return new Date(Date.now() + (minutes < 10 ? 5 : -5) * 60_000).toISOString();
}

/** A student who signed up, with a meeting link and a lesson at `startsAt`. */
async function studentWithLesson(
  request: APIRequestContext,
  name: string,
  startsAt: string,
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
  const login = `s${RUN}${String(Math.random()).slice(2, 6)}`;
  const password = `pass-${RUN}-secret`;
  expect(
    (
      await request.post(`/api/auth/invites/${invite.token}/accept`, { data: { login, password } })
    ).ok(),
  ).toBe(true);
  if (meeting) {
    const room = await request.put('/api/teacher/meetings/rooms', {
      headers,
      data: { studentId: student.id, groupId: null, joinUrl: MEETING },
    });
    expect(room.ok()).toBe(true);
  }
  const lesson = await request.post('/api/teacher/schedule/lessons', {
    headers,
    data: { studentId: student.id, startsAt, durationMinutes: 120, allowOverlap: true },
  });
  expect(lesson.ok()).toBe(true);
  return { login, password };
}

test('a field is 56 px high with its label on the outline, primary in focus', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  await page.goto('/teacher/account');

  const input = page.locator('#account-name');
  const label = page.locator('label[for="account-name"]');
  const field = await input.boundingBox();
  const caption = await label.boundingBox();
  expect(Math.round(field?.height ?? 0)).toBe(56);
  // the middle of the label is on the top line of the outline
  const middle = (caption?.y ?? 0) + (caption?.height ?? 0) / 2;
  expect(Math.abs(middle - (field?.y ?? 0))).toBeLessThanOrEqual(1);

  const color = (): Promise<string> => label.evaluate((element) => getComputedStyle(element).color);
  const before = await color();
  await input.focus();
  await expect.poll(color).not.toBe(before);
  const primary = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--p-md-primary)';
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  });
  expect(await color()).toBe(primary);
});

test('the search is a filled pill and a menu is an Expressive menu', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);
  await page.goto('/teacher/students');

  const search = page.getByPlaceholder('Поиск по имени');
  const style = await search.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      radius: parseFloat(computed.borderTopLeftRadius),
      background: computed.backgroundColor,
    };
  });
  expect(style.radius).toBeGreaterThanOrEqual(28);
  expect(style.background).not.toBe('rgba(0, 0, 0, 0)');

  await page.getByRole('button', { name: 'Меню пользователя' }).click();
  const menu = page.locator('.p-menu, .p-tieredmenu').filter({ hasText: 'Мой аккаунт' }).first();
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((element) => getComputedStyle(element).borderTopLeftRadius)).toBe(
    '16px',
  );
  const item = menu.locator('.p-menu-item-content, .p-tieredmenu-item-content').first();
  expect(await item.evaluate((element) => getComputedStyle(element).borderTopLeftRadius)).toBe(
    '12px',
  );
});

test('«Начать урок» is a split button with the browser in its menu', async ({
  browser,
  request,
}) => {
  const name = `Сплит ${RUN}`;
  await studentWithLesson(request, name, ongoingStart(), true);
  const context = await browser.newContext({ userAgent: WINDOWS });
  const page = await context.newPage();
  await signIn(page, 'teacher', TEACHER_PASSWORD, 1280);

  const row = page.locator('tb-today-lessons-widget li').filter({ hasText: name });
  const split = row.getByRole('group', { name: 'Начать урок' });
  await expect(split.getByRole('button', { name: 'Начать урок' })).toBeVisible();
  await expect(row.getByRole('link', { name: 'в браузере' })).toHaveCount(0);

  await split.getByRole('button', { name: 'Другие способы открыть встречу' }).click();
  const browserItem = page.getByRole('menuitem', { name: 'Открыть в браузере' });
  await expect(browserItem).toBeVisible();
  await expect(browserItem.locator('a')).toHaveAttribute('href', MEETING);
  await context.close();
});

test('on a phone an upcoming lesson opens its actions in the bottom sheet', async ({
  page,
  request,
}) => {
  const online = await studentWithLesson(request, `Лист ${RUN}`, upcomingStart(21), true);
  await signIn(page, online.login, online.password, 360);
  await page.goto('/cabinet/schedule');

  const row = page.locator('ul.tb-list > li').first();
  await expect(row.locator('.tb-list__lead .pi-video')).toBeVisible();
  await expect(row.getByRole('button', { name: 'Перенести' })).toHaveCount(0);
  await expect(row.getByRole('link', { name: /Войти в урок/ })).toHaveCount(0);

  await row.click();
  const sheet = page.locator('.p-drawer.tb-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('link', { name: /Войти в урок/ })).toHaveAttribute('href', MEETING);
  const halves = await sheet.locator('.tb-button-group .p-button').evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { top: Math.round(box.top), width: Math.round(box.width) };
    }),
  );
  expect(halves).toHaveLength(2);
  expect(halves[0]?.top).toBe(halves[1]?.top);
  expect(Math.abs((halves[0]?.width ?? 0) - (halves[1]?.width ?? -9))).toBeLessThanOrEqual(1);

  await sheet.getByRole('button', { name: 'Перенести' }).click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Перенести занятие' })).toBeVisible();
});

test('on a phone the nearest lesson stacks its buttons', async ({ page, request }) => {
  const plain = await studentWithLesson(request, `Главная ${RUN}`, upcomingStart(20), false);
  await signIn(page, plain.login, plain.password, 360);

  const hero = page.locator('tb-next-lesson-widget');
  const group = hero.locator('.tb-button-group');
  await expect(group.getByRole('button', { name: 'Перенести' })).toBeVisible();
  const tops = await group
    .locator('.p-button')
    .evaluateAll((buttons) =>
      buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
    );
  expect(tops).toHaveLength(2);
  expect(tops[0]).toBe(tops[1]);
});
