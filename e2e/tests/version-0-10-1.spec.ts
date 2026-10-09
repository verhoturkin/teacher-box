import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.10.1: a lesson dragged in the calendar is saved only after «Перенести» on its card
 * («Отменить перенос» puts it back); the top bar keeps its tone on scroll; on a phone the bottom bar leads
 * with «Главная», «Расписание», «Доски», «Оплаты»; new icons of «Задания» and «Учебники».
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Ученик с переносом ${RUN}`;
const PHONE = { width: 375, height: 812 };

test.describe.configure({ mode: 'serial' });

let lessonId = '';
let startsAt = '';

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

async function lessonStart(request: APIRequestContext): Promise<string> {
  const response = await request.get(`/api/teacher/schedule/lessons/${lessonId}`, {
    headers: await bearer(request),
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { startsAt: string }).startsAt;
}

/** Drags the lesson card two hours down the week grid. */
async function dragDown(page: Page): Promise<void> {
  const card = page.locator('.tb-lesson', { hasText: STUDENT });
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  const x = box.x + box.width / 2;
  const y = box.y + 6;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 5 });
  await page.mouse.move(x, y + box.height * 2, { steps: 10 });
  await page.mouse.up();
}

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: STUDENT, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student } = (await created.json()) as { student: { id: string } };
  // today at 10:00 of the browser's time zone: the week view opens on it
  const start = new Date();
  start.setHours(10, 0, 0, 0);
  const lesson = await request.post('/api/teacher/schedule/lessons', {
    headers,
    data: {
      studentId: student.id,
      startsAt: start.toISOString(),
      durationMinutes: 60,
      allowOverlap: true,
    },
  });
  expect(lesson.ok()).toBe(true);
  ({ id: lessonId, startsAt } = (await lesson.json()) as { id: string; startsAt: string });
});

test('a dragged lesson waits for «Перенести» on its card', async ({ page, request }) => {
  await signIn(page);
  await page.goto('/teacher/schedule');
  await expect(page.locator('.tb-lesson', { hasText: STUDENT })).toBeVisible();

  await dragDown(page);
  const card = page.locator('.tb-lesson--moving');
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: 'Перенести' })).toBeVisible();
  // nothing is saved yet
  expect(await lessonStart(request)).toBe(startsAt);

  await card.getByRole('button', { name: 'Отменить перенос' }).click();
  await expect(page.locator('.tb-lesson--moving')).toHaveCount(0);
  expect(await lessonStart(request)).toBe(startsAt);

  await dragDown(page);
  await page.locator('.tb-lesson--moving').getByRole('button', { name: 'Перенести' }).click();
  // other lessons of the instance may stand at that time: the portal asks once more
  const overlap = page.getByRole('alertdialog', { name: 'Время занято' });
  await expect
    .poll(async () => {
      if (await overlap.isVisible()) {
        await overlap.getByRole('button', { name: 'Перенести' }).click();
      }
      return lessonStart(request);
    })
    .not.toBe(startsAt);
  await expect(page.locator('.tb-lesson--moving')).toHaveCount(0);
});

test('the top bar keeps its tone when the page scrolls', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/schedule');
  const header = page.locator('.tb-shell__header');
  const tone = () => header.evaluate((element) => getComputedStyle(element).backgroundColor);
  const before = await tone();

  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await tone()).toBe(before);
});

test('the sections have their icons and the phone bar leads with the daily ones', async ({
  page,
}) => {
  await signIn(page);
  const nav = page.locator('tb-side-nav');
  await expect(nav.getByRole('link', { name: 'Задания' }).locator('.pi-pen-to-square')).toHaveCount(
    1,
  );
  await expect(nav.getByRole('link', { name: 'Учебники' }).locator('.pi-book')).toHaveCount(1);

  await page.setViewportSize(PHONE);
  const bar = page.locator('nav.tb-bottom-nav');
  await expect(bar.getByRole('link')).toHaveText(['Главная', 'Расписание', 'Доски', 'Оплаты']);
  await bar.getByRole('button', { name: 'Ещё разделы' }).click();
  for (const section of ['Звонки', 'Ученики', 'Задания', 'Учебники']) {
    await expect(page.getByRole('menuitem', { name: section })).toBeVisible();
  }
});
