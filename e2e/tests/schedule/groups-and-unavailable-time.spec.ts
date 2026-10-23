import { bearer, startSession } from '../support/session';
import { type Browser, type Page, expect, test } from '@playwright/test';
import { create } from '../support/create';
import { laterThisWeek, saveLesson } from '../support/this-week';

/**
 * Version 0.5.3: groups under the students, the student's upcoming lessons of this week only, the
 * teacher's off time a student cannot move a lesson into and the time zone chosen from a list.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8091';
const RUN = Date.now().toString(36);
const STUDENT = `Вера ${RUN}`;
const OFF_TIME = `Врач ${RUN}`;
const STUDENT_LOGIN = `vera-${RUN}`;
const STUDENT_PASSWORD = 'e2e-student-pass-153';

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

/** `dd.MM.yyyy HH:mm` of a day relative to today (the format of the date pickers). */
function dateTime(daysFromToday: number, hours: number, minutes = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())} ${pad(hours)}:${pad(minutes)}`;
}

async function planLesson(page: Page, daysFromToday: number, hours: number, topic: string) {
  await page.goto('/teacher/schedule');
  await create(page, 'Занятие');
  await page.locator('p-select:has(#schedule-lesson-student)').click();
  await page.getByRole('option', { name: STUDENT }).click();
  // The date picker parses typed keys, not a pasted value.
  await page.locator('#schedule-lesson-start').pressSequentially(dateTime(daysFromToday, hours));
  await page.locator('#schedule-lesson-topic').fill(topic);
  await saveLesson(page);
}

async function studentPage(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ baseURL: BASE_URL })).newPage();
  await signIn(page, STUDENT_LOGIN, STUDENT_PASSWORD);
  await expect(page).toHaveURL(/\/cabinet$/);
  return page;
}

test('the groups are in the list of students, without tabs', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/students');
  await create(page, 'Ученик');
  await page.getByLabel('Имя и фамилия').fill(STUDENT);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  const link = page.getByRole('textbox', { name: 'Ссылка-приглашение' });
  await expect(link).toHaveValue(/\/invite\//);
  const invite = await link.inputValue();
  await page.keyboard.press('Escape');
  // 0.23.0: the new student's card opened beside the list; the list itself has no tabs
  await page.goto('/teacher/students');

  await expect(page.getByRole('tab')).toHaveCount(0);
  // 0.23.0: groups are rows of the same list, the chip «Группы» filters them
  await expect(page.getByRole('button', { name: 'Создать группу' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Фильтр списка' })).toContainText('Группы');
  await expect(
    page.locator('ul.tb-list[aria-label="Ученики"] > li').filter({ hasText: STUDENT }),
  ).toBeVisible();

  const student = await (await browser.newContext({ baseURL: BASE_URL })).newPage();
  await student.goto(invite);
  await student.getByLabel('Логин').fill(STUDENT_LOGIN);
  await student.locator('#password').fill(STUDENT_PASSWORD);
  await student.locator('#confirm').fill(STUDENT_PASSWORD);
  await student.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(student).toHaveURL(/\/cabinet$/);
  await student.context().close();
});

test('a student cannot ask to move a lesson into the teacher’s off time', async ({
  page,
  browser,
  request: api,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  const lesson = laterThisWeek(10);
  await planLesson(page, lesson.days, lesson.hours, 'Ближняя');
  // Eight days ahead is always a later week.
  await planLesson(page, 8, 10, 'Дальняя');

  // Pick an otherwise free day: another suite's lessons must not keep the slot busy after deletion.
  const response = await api.get('/api/me/schedule/busy', {
    headers: await bearer(api, STUDENT_LOGIN, STUDENT_PASSWORD),
    params: {
      from: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      to: new Date(Date.now() + 32 * 86_400_000).toISOString(),
    },
  });
  expect(response.ok()).toBe(true);
  const busy = (await response.json()) as { start: string; end: string }[];
  const freeDay = Array.from({ length: 21 }, (_, index) => index + 9).find((days) => {
    const day = dateTime(days, 9).slice(0, 10).split('.').reverse().join('-');
    const start = Date.parse(`${day}T09:00:00+03:00`);
    const end = Date.parse(`${day}T18:00:00+03:00`);
    return busy.every((time) => Date.parse(time.end) <= start || Date.parse(time.start) >= end);
  });
  if (freeDay === undefined) throw new Error('No free day for the off-time scenario');

  // 0.24.0: off time is a tab of the schedule's side pane
  await page.getByRole('button', { name: 'Добавить нерабочее время' }).click();
  const dialog = page.getByRole('dialog', { name: 'Нерабочее время' });
  await expect(dialog.getByRole('button', { name: 'Один раз' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#off-time-starts-at').clear();
  await page.locator('#off-time-starts-at').pressSequentially(dateTime(freeDay, 9));
  await page.locator('#off-time-ends-at').clear();
  await page.locator('#off-time-ends-at').pressSequentially(dateTime(freeDay, 18));
  await page.locator('#off-time-note').fill(OFF_TIME);
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).toBeHidden();
  const offTime = page.locator('.tb-schedule-side li').filter({ hasText: OFF_TIME });
  await expect(offTime).toBeVisible();

  const student = await studentPage(browser);
  await student.goto('/cabinet/schedule');
  const upcoming = student
    .locator('section')
    .filter({ has: student.getByRole('heading', { name: 'Ближайшие занятия', exact: true }) });
  await expect(upcoming).toContainText('Ближняя');
  await expect(upcoming).not.toContainText('Дальняя');
  await upcoming.getByRole('button', { name: 'Перенести' }).click();
  const request = student.getByRole('dialog', { name: 'Перенести занятие' });
  await student.locator('#request-start').pressSequentially(dateTime(freeDay, 12));
  await expect(request).toContainText('В это время учитель занят');
  await expect(request.getByRole('button', { name: 'Отправить учителю' })).toBeDisabled();
  await expect(student.getByText('Врач')).toHaveCount(0);

  // 0.15.3: the actions of a day off are in «⋮»
  await offTime.getByRole('button', { name: /^Действия: / }).click();
  await page.getByRole('menuitem', { name: 'Удалить…' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(offTime).toHaveCount(0);

  await student.locator('#request-start').clear();
  await student.locator('#request-start').pressSequentially(dateTime(freeDay, 12, 5));
  await expect(request).not.toContainText('В это время учитель занят');
  await student.context().close();
});

test('the administrator chooses the time zone from the list', async ({ page }) => {
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/admin/settings/portal');
  const setting = page
    .locator('.tb-setting')
    .filter({ has: page.locator('#setting-TEACHERBOX_TIMEZONE') });
  await setting.locator('p-select').click();
  await page.locator('.p-select-overlay input').fill('Moscow');
  await page.getByRole('option', { name: 'Europe/Moscow (UTC+03:00)' }).click();

  await expect(setting).toContainText('Europe/Moscow (UTC+03:00)');
  await expect(setting).toContainText('изменено');
  await expect(page.getByRole('button', { name: /Сохранить и перезапустить$/ })).toBeEnabled();
});
