import { type Browser, type Page, expect, test } from '@playwright/test';
import { laterThisWeek, saveLesson } from './this-week';

/**
 * Version 0.5: tabs on the page and five sections in the phone navigation, payments without a
 * method, cancelling, restoring and deleting a lesson, the teacher's busy time when a student moves
 * a lesson, the portal's own color and a setting the administrator changes with a restart.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8091';
const RUN = Date.now().toString(36);
const STUDENT = `Ира ${RUN}`;
const OTHER = `Олег ${RUN}`;
const STUDENT_LOGIN = `ira-${RUN}`;
const STUDENT_PASSWORD = 'e2e-student-pass-15';
const PHONE = { width: 375, height: 812 };

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

async function addStudent(page: Page, name: string): Promise<string> {
  await page.goto('/teacher/students');
  await page.locator('.tb-page-header').getByRole('button', { name: 'Добавить ученика' }).click();
  await page.getByLabel('Имя и фамилия').fill(name);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  const link = page.getByRole('textbox', { name: 'Ссылка-приглашение' });
  await expect(link).toHaveValue(/\/invite\//);
  const invite = await link.inputValue();
  await page.keyboard.press('Escape');
  return invite;
}

async function planLesson(
  page: Page,
  student: string,
  daysFromToday: number,
  hours: number,
  topic: string,
): Promise<void> {
  await page.goto('/teacher/schedule');
  // The accessible name starts with the icon glyph.
  await page.getByRole('button', { name: /Занятие$/ }).click();
  await page.locator('p-select:has(#schedule-lesson-student)').click();
  await page.getByRole('option', { name: student }).click();
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

// Since 0.6.6 the notifications have folding cards instead of tabs (ADR-0019).
test('sections lie on the page and the phone navigation has five even sections', async ({
  page,
  browser,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/notifications');
  await expect(
    page.locator('#notifications-preferences').getByRole('button', { expanded: false }),
  ).toContainText('Что присылать');

  const phone = await (await browser.newContext({ baseURL: BASE_URL, viewport: PHONE })).newPage();
  await signIn(phone, 'teacher', TEACHER_PASSWORD);
  const nav = phone.locator('nav.tb-bottom-nav');
  // 0.8.0: «Звонки» after «Расписание», «Задания» under «Ещё»
  await expect(nav.getByRole('link')).toHaveText(['Главная', 'Расписание', 'Звонки', 'Ученики']);
  const widths = await nav
    .locator('.tb-bottom-nav__item')
    .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().width)));
  expect(widths).toHaveLength(5);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  await phone.context().close();
});

test('a student signs up and a payment is recorded without a method', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  const invite = await addStudent(page, STUDENT);
  await addStudent(page, OTHER);

  const student = await (await browser.newContext({ baseURL: BASE_URL })).newPage();
  await student.goto(invite);
  await student.getByLabel('Логин').fill(STUDENT_LOGIN);
  await student.locator('#password').fill(STUDENT_PASSWORD);
  await student.locator('#confirm').fill(STUDENT_PASSWORD);
  await student.getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(student).toHaveURL(/\/cabinet$/);
  await student.context().close();

  await page.goto('/teacher/billing');
  await page.getByRole('button', { name: `Записать оплату: ${STUDENT}` }).click();
  const dialog = page.getByRole('dialog', { name: 'Оплата' });
  await expect(dialog).not.toContainText('Способ');
  await page.locator('#payment-amount').pressSequentially('2000');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('row', { name: new RegExp(STUDENT) })).toContainText('2 000');
});

test('the teacher cancels, restores and deletes a lesson', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  // Today is always in the week shown; 07:00 is the first hour of the calendar.
  await planLesson(page, STUDENT, 0, 7, 'Лишнее');
  const event = page.getByText(`${STUDENT} · Лишнее`);
  const card = page.getByRole('dialog', { name: 'Занятие' });

  await event.click();
  await card.getByRole('button', { name: 'Другие действия' }).click();
  await page.getByRole('menuitem', { name: 'Отменить занятие…' }).click();
  await card.getByRole('button', { name: 'Отменить занятие' }).click();
  await expect(card).toBeHidden();

  await event.click();
  await expect(card).toContainText('Отменено');
  await card.getByRole('button', { name: 'Восстановить' }).click();
  await expect(card).toBeHidden();

  await event.click();
  await expect(card).toContainText('Запланировано');
  await card.getByRole('button', { name: 'Другие действия' }).click();
  await page.getByRole('menuitem', { name: 'Удалить…' }).click();
  await card.getByRole('button', { name: 'Удалить занятие' }).click();
  await expect(card).toBeHidden();
  await expect(event).toHaveCount(0);
});

test('a student cannot ask to move a lesson into the teacher’s busy time', async ({
  page,
  browser,
}) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  // The student's list of upcoming lessons shows this week only.
  const own = laterThisWeek(12);
  await planLesson(page, STUDENT, own.days, own.hours, 'Своё');
  await planLesson(page, OTHER, 6, 12, 'Чужое');

  const student = await studentPage(browser);
  await student.goto('/cabinet/schedule');
  await student.getByRole('button', { name: 'Перенести' }).click();
  const dialog = student.getByRole('dialog', { name: 'Перенести занятие' });
  await student.locator('#request-start').pressSequentially(dateTime(6, 12, 30));
  await expect(dialog).toContainText('В это время учитель занят');
  await expect(dialog.getByRole('button', { name: 'Отправить учителю' })).toBeDisabled();

  await student.locator('#request-start').clear();
  await student.locator('#request-start').pressSequentially(dateTime(6, 15));
  await expect(dialog).not.toContainText('В это время учитель занят');
  await dialog.getByRole('button', { name: 'Отправить учителю' }).click();
  await expect(student.getByText('ждёт ответа учителя')).toBeVisible();
  await expect(student.getByText('Чужое')).toHaveCount(0);
  await expect(student.getByText(OTHER)).toHaveCount(0);
  await student.context().close();
});

test('the teacher gives the portal an own color', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/settings?open=portal');
  const card = page.locator('#portal');
  await card.getByRole('radio', { name: 'Свой цвет' }).click();
  await card.locator('#portal-own-color').fill('#1e40af');
  await card.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Настройки портала сохранены')).toBeVisible();

  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--p-primary-500').trim(),
      ),
    )
    .toBe('#1e40af');

  await page.locator('#portal').getByRole('radio', { name: 'Индиго' }).click();
  await page.locator('#portal').getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Настройки портала сохранены')).toBeVisible();
});

test('the administrator changes a setting and the portal restarts to apply it', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/admin/settings?open=backups');
  const keep = page.locator('#setting-TEACHERBOX_BACKUP_KEEP');
  await keep.fill('9');
  await page.getByRole('button', { name: 'Сохранить и перезапустить' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сохранить настройки' });
  await dialog.locator('#settings-password').fill(ADMIN_PASSWORD);
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).toContainText('Портал перезапускается');
  await expect(dialog).toContainText('Портал перезапущен, настройки применены', {
    timeout: 180_000,
  });
  await dialog.getByRole('button', { name: 'Готово' }).click();

  await expect(keep).toHaveValue('9');
  await expect(page.locator('.tb-setting').filter({ has: keep })).toContainText('задано здесь');
});
