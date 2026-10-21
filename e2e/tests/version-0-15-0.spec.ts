import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.15.0: the nearest lesson as a calendar event (a time tile, no «Расписание» link, no visible title); the
 * quick actions as a FAB menu on a phone; the help as a modal side sheet where linked articles open with «←»;
 * assignments in «Активные» / «Выполненные» with a search; a search of the boards; one M3 search bar with
 * «Очистить поиск»; «Назад» of a board returns where it was opened from.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученица выпуска ${RUN}`;
const ASSIGNMENT = `Задание выпуска ${RUN}`;
const BOARD = `Доска выпуска ${RUN}`;
const PHONE = { width: 375, height: 812 };

test.describe.configure({ mode: 'serial' });

let boardId = '';

async function bearer(request: APIRequestContext): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function signIn(page: Page, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student } = (await created.json()) as { student: { id: string } };

  // a lesson in half an hour: the home page has a nearest lesson (maybe another spec's)
  const lesson = await request.post('/api/teacher/schedule/lessons', {
    headers,
    data: {
      studentId: student.id,
      startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      durationMinutes: 60,
      allowOverlap: true,
    },
  });
  expect(lesson.ok()).toBe(true);

  const assignment = await request.post('/api/teacher/homework/assignments', {
    headers,
    data: { title: ASSIGNMENT, description: 'Упражнения', studentIds: [student.id] },
  });
  expect(assignment.ok()).toBe(true);

  const board = await request.post('/api/teacher/boards', {
    headers,
    data: { kind: 'EXCALIDRAW', title: BOARD, url: null, studentIds: [student.id], groupIds: [] },
  });
  expect(board.ok()).toBe(true);
  ({ id: boardId } = (await board.json()) as { id: string });
});

test('the nearest lesson is a calendar event without a title or «Расписание»', async ({ page }) => {
  await signIn(page);
  const hero = page.locator('.p-card.tb-hero');
  await expect(hero.locator('tb-lesson-time-tile')).toBeVisible();
  await expect(hero.locator('tb-lesson-time-tile')).toHaveText(/\d{2}:\d{2}/);
  await expect(hero.getByRole('link', { name: 'Расписание' })).toHaveCount(0);
  // the title is for screen readers only
  await expect(hero.getByRole('heading', { name: 'Следующее занятие' })).toHaveClass(/tb-sr-only/);
});

test('on a phone «Создать» of the home page is a FAB menu', async ({ page }) => {
  await signIn(page, PHONE.width);
  // 232.2: the rail's «Создать» with its six items instead of the four quick actions
  const fab = page.getByRole('button', { name: 'Создать' });
  await fab.click();
  const close = page.getByRole('button', { name: 'Закрыть' });
  await expect(close).toHaveAttribute('aria-expanded', 'true');
  for (const action of ['Занятие', 'Задание', 'Оплата', 'Ученик', 'Доска']) {
    await expect(page.locator('tb-fab-menu').getByRole('link', { name: action })).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(fab).toBeFocused();

  // 235.3: «Сообщение» opens the dialog of a new message over the home page
  await fab.click();
  await page.locator('tb-fab-menu').getByRole('button', { name: 'Сообщение' }).click();
  const message = page.getByRole('dialog', { name: 'Сообщение ученикам' });
  await expect(message).toBeVisible();
  await expect(page).toHaveURL(/\/teacher$/);
  await message.getByRole('button', { name: 'Отмена' }).click();
  await expect(message).toBeHidden();

  await fab.click();
  await page.locator('tb-fab-menu').getByRole('link', { name: 'Оплата' }).click();
  await expect(page).toHaveURL(/\/teacher\/billing/);
});

test('the help is a side sheet: a linked article opens in it and «Назад» returns', async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Справка: Первые шаги' }).click();
  const sheet = page.getByRole('dialog', { name: 'Первые шаги' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Назад' })).toHaveCount(0);

  await sheet.getByRole('link', { name: 'Ученики и приглашения' }).click();
  await expect(page.getByRole('dialog', { name: 'Ученики и приглашения' })).toBeVisible();
  await expect(page).toHaveURL(/\/teacher$/);

  await page.getByRole('dialog').getByRole('button', { name: 'Назад' }).click();
  await expect(page.getByRole('dialog', { name: 'Первые шаги' })).toBeVisible();
});

test('assignments are filtered by a connected group, with a search to clear', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/homework');
  const filters = page.getByRole('group', { name: 'Что показать' });
  await expect(filters.getByRole('button', { name: /^На проверку/ })).toBeVisible();
  await expect(filters.getByRole('button', { name: /^Готовые/ })).toBeVisible();
  await filters.getByRole('button', { name: /^Активные/ }).click();

  await page.getByRole('button', { name: 'Поиск', exact: true }).click();
  const search = page.getByRole('searchbox', { name: 'Название или ученик' });
  await search.fill(STUDENT);
  await expect(page.getByRole('link', { name: ASSIGNMENT })).toBeVisible();
  await search.fill(`нет такого ${RUN}`);
  await expect(page.getByText('Ничего не найдено')).toBeVisible();

  await page.getByRole('button', { name: 'Очистить поиск' }).first().click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
});

test('boards are found by a student, and «Назад» of a board returns to the list', async ({
  page,
}) => {
  await signIn(page);
  // 0.26.0: the boards are a tab of «Материалы» with one search
  await page.goto('/teacher/boards');
  const search = page.getByRole('searchbox', { name: 'Название, ученик или группа' });
  await search.fill(STUDENT);
  await expect(page.getByRole('link', { name: BOARD })).toBeVisible();

  await page.getByRole('link', { name: BOARD }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher/boards/${boardId}`));
  await page.getByRole('button', { name: 'Назад', exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/materials\?tab=boards$/);

  // opened by a link from outside, the board leads to the list of boards
  await page.goto(`/teacher/boards/${boardId}`);
  await expect(page.getByRole('link', { name: 'Доски' })).toBeVisible();
});
