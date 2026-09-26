import { type Browser, type Page, expect, test } from '@playwright/test';

/**
 * The main scenario of the portal, from the teacher's first sign-in to the student's inbox:
 * a student is invited and signs up, gets homework and hands it in, the teacher registers a
 * payment and the student sees the notification in the personal area; a lesson from the schedule
 * is charged, and the student moves a lesson with the teacher's consent.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT_NAME = `Ученик ${RUN}`;
const STUDENT_LOGIN = `student-${RUN}`;
const STUDENT_PASSWORD = `pass-${RUN}-secret`;
const HOMEWORK_TITLE = `Дроби ${RUN}`;

test.describe.configure({ mode: 'serial' });

let inviteLink = '';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

/** `dd.MM.yyyy HH:mm` of a day relative to today (the format of the date pickers). */
function dateTime(daysFromToday: number, hours: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())} ${pad(hours)}:00`;
}

async function planLesson(page: Page, daysFromToday: number, hours: number, topic: string): Promise<void> {
  await page.getByRole('menuitem', { name: 'Расписание' }).click();
  // The accessible name starts with the icon glyph.
  await page.getByRole('button', { name: /Занятие$/ }).click();
  await page.locator('p-select:has(#schedule-lesson-student)').click();
  await page.getByRole('option', { name: STUDENT_NAME }).click();
  // The date picker parses typed keys, not a pasted value.
  await page.locator('#schedule-lesson-start').pressSequentially(dateTime(daysFromToday, hours));
  await page.locator('#schedule-lesson-topic').fill(topic);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

async function studentPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, STUDENT_LOGIN, STUDENT_PASSWORD);
  await expect(page).toHaveURL(/\/cabinet$/);
  return page;
}

test('the teacher signs in and invites a student', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await expect(page).toHaveURL(/\/teacher$/);

  await page.getByRole('menuitem', { name: 'Ученики' }).click();
  await page.getByRole('button', { name: 'Добавить ученика' }).click();
  await page.getByLabel('Имя и фамилия').fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Сохранить' }).click();

  const link = page.getByLabel('Ссылка-приглашение');
  await expect(link).toHaveValue(/\/invite\//);
  inviteLink = await link.inputValue();
});

test('the student accepts the invitation', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(inviteLink);

  await page.getByLabel('Логин').fill(STUDENT_LOGIN);
  await page.locator('#password').fill(STUDENT_PASSWORD);
  await page.locator('#confirm').fill(STUDENT_PASSWORD);
  await page.getByRole('button', { name: 'Создать аккаунт' }).click();

  await expect(page).toHaveURL(/\/cabinet$/);
  await expect(page.getByText(STUDENT_NAME)).toBeVisible();
});

test('the teacher gives homework and the student hands it in', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.getByRole('menuitem', { name: 'Задания' }).click();
  await page.getByRole('button', { name: 'Новое задание' }).click();
  await page.locator('#assignment-title').fill(HOMEWORK_TITLE);
  await page.locator('#assignment-description').fill('1. Сложите 1/2 и 1/3');
  // PrimeNG puts the id on a hidden input; the component itself opens the list.
  await page.locator('p-multiselect:has(#assignment-students)').click();
  await page.getByRole('option', { name: STUDENT_NAME }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Выдать' }).click();
  await expect(page.getByRole('heading', { name: HOMEWORK_TITLE })).toBeVisible();
  const studentRow = page.getByRole('row', { name: new RegExp(STUDENT_NAME) });
  await expect(studentRow).toContainText('Выдано');

  const student = await studentPage(browser);
  await student.getByRole('menuitem', { name: 'Задания' }).click();
  await student.getByRole('link', { name: HOMEWORK_TITLE }).click();
  await student.locator('#answer-text').fill('1/2 + 1/3 = 5/6');
  await student.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(student.getByText('1/2 + 1/3 = 5/6')).toBeVisible();

  await page.reload();
  await expect(studentRow).toContainText('На проверке');
});

test('a payment reaches the student inbox', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.getByRole('menuitem', { name: 'Оплаты' }).click();
  await page.getByRole('button', { name: `Оплата: ${STUDENT_NAME}` }).click();
  await page.locator('#payment-amount').pressSequentially('3000');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('row', { name: new RegExp(STUDENT_NAME) })).toContainText('3 000');

  const student = await studentPage(browser);
  await student.getByRole('button', { name: /Уведомления/ }).click();
  await expect(student).toHaveURL(/\/cabinet\/notifications$/);
  await expect(student.getByText('Получена оплата 3 000 ₽')).toBeVisible({ timeout: 20_000 });
  await expect(student.getByText(`Новое задание: «${HOMEWORK_TITLE}»`)).toBeVisible();
});

test('a lesson marked in the schedule is charged', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await planLesson(page, -1, 10, 'Повторение');

  await page.getByRole('button', { name: `Проведено: ${STUDENT_NAME}` }).click();
  await expect(page.getByRole('button', { name: `Проведено: ${STUDENT_NAME}` })).toBeHidden();

  await page.getByRole('menuitem', { name: 'Оплаты' }).click();
  await expect(page.getByRole('row', { name: new RegExp(STUDENT_NAME) })).toContainText('1 500');
  await page.getByRole('link', { name: STUDENT_NAME }).click();
  await expect(page.getByText('Повторение')).toBeVisible();
});

test('the student moves a lesson when the teacher agrees', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await planLesson(page, 3, 15, 'Проценты');

  const student = await studentPage(browser);
  await student.getByRole('menuitem', { name: 'Расписание' }).click();
  await student.getByRole('button', { name: 'Перенести' }).click();
  await student.locator('#request-start').pressSequentially(dateTime(4, 16));
  await student.locator('#request-comment').fill('Можно на день позже?');
  await student.getByRole('button', { name: 'Отправить учителю' }).click();
  await expect(student.getByText('ждёт ответа учителя')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Ответить' }).click();
  await page.getByRole('button', { name: 'Согласовать' }).click();
  await expect(page.getByRole('button', { name: 'Ответить' })).toBeHidden();

  await student.reload();
  await expect(student.getByText('Согласовано')).toBeVisible();
});
