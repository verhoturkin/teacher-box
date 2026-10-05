import { type Browser, type Page, expect, test } from '@playwright/test';
import { laterThisWeek, saveLesson } from './this-week';

/**
 * Version 1.5.3: groups under the students, the student's upcoming lessons of this week only, the
 * teacher's off time a student cannot move a lesson into and the time zone chosen from a list.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8091';
const RUN = Date.now().toString(36);
const STUDENT = `Вера ${RUN}`;
const STUDENT_LOGIN = `vera-${RUN}`;
const STUDENT_PASSWORD = 'e2e-student-pass-153';

test.describe.configure({ mode: 'serial' });

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  // The next page opened before the sign-in finishes would lead back to the sign-in page.
  await expect(page).not.toHaveURL(/\/login/);
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
  // The accessible name starts with the icon glyph.
  await page.getByRole('button', { name: /Занятие$/ }).click();
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

test('the groups are under the students, without tabs', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/students');
  await page.locator('.tb-page-header').getByRole('button', { name: 'Добавить ученика' }).click();
  await page.getByLabel('Имя и фамилия').fill(STUDENT);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  const link = page.getByRole('textbox', { name: 'Ссылка-приглашение' });
  await expect(link).toHaveValue(/\/invite\//);
  const invite = await link.inputValue();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('tab')).toHaveCount(0);
  const groups = page.locator('p-card', {
    has: page.locator('.p-card-title', { hasText: 'Группы' }),
  });
  await expect(groups.getByRole('button', { name: /Создать группу$/ }).first()).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(STUDENT) })).toBeVisible();

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
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  const lesson = laterThisWeek(10);
  await planLesson(page, lesson.days, lesson.hours, 'Ближняя');
  // Eight days ahead is always a later week.
  await planLesson(page, 8, 10, 'Дальняя');

  await page.getByRole('button', { name: 'Добавить нерабочее время' }).click();
  const dialog = page.getByRole('dialog', { name: 'Нерабочее время' });
  await expect(dialog.getByRole('button', { name: 'Один раз' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.locator('#off-time-starts-at').clear();
  await page.locator('#off-time-starts-at').pressSequentially(dateTime(9, 9));
  await page.locator('#off-time-ends-at').clear();
  await page.locator('#off-time-ends-at').pressSequentially(dateTime(9, 18));
  await page.locator('#off-time-note').fill('Врач');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(dialog).toBeHidden();
  const offTime = page.locator('p-card').filter({ hasText: 'Врач' });
  await expect(offTime).toBeVisible();

  const student = await studentPage(browser);
  await student.goto('/cabinet/schedule');
  const upcoming = student.locator('p-card').filter({ hasText: 'Ближайшие занятия' });
  await expect(upcoming).toContainText('Ближняя');
  await expect(upcoming).not.toContainText('Дальняя');
  await upcoming.getByRole('button', { name: 'Перенести' }).click();
  const request = student.getByRole('dialog', { name: 'Перенести занятие' });
  await student.locator('#request-start').pressSequentially(dateTime(9, 12));
  await expect(request).toContainText('В это время учитель занят');
  await expect(request.getByRole('button', { name: 'Отправить учителю' })).toBeDisabled();
  await expect(student.getByText('Врач')).toHaveCount(0);

  await page.getByRole('button', { name: /^Удалить нерабочее время/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(page.getByText('Отметьте обед, выходные или отпуск')).toBeVisible();

  await student.locator('#request-start').clear();
  await student.locator('#request-start').pressSequentially(dateTime(9, 12, 5));
  await expect(request).not.toContainText('В это время учитель занят');
  await student.context().close();
});

test('the administrator chooses the time zone from the list', async ({ page }) => {
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/admin/settings');
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
