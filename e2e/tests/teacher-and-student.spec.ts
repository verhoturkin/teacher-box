import { type Browser, type Page, expect, test } from '@playwright/test';
import { create } from './create';
import { laterThisWeek, saveLesson } from './this-week';

/**
 * The main scenario of the portal, from the teacher's first sign-in to the student's inbox:
 * a student is invited and signs up, gets homework and hands it in, the teacher registers a
 * payment and the student sees the notification in the personal area; a lesson from the schedule
 * is charged, and the student moves a lesson with the teacher's consent; the home pages sum it up.
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

async function planLesson(
  page: Page,
  daysFromToday: number,
  hours: number,
  topic: string,
): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Расписание' })
    .click();
  await create(page, 'Занятие');
  await page.locator('p-select:has(#schedule-lesson-student)').click();
  await page.getByRole('option', { name: STUDENT_NAME }).click();
  // The date picker parses typed keys, not a pasted value.
  await page.locator('#schedule-lesson-start').pressSequentially(dateTime(daysFromToday, hours));
  await page.locator('#schedule-lesson-topic').fill(topic);
  await saveLesson(page);
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

  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Ученики' })
    .click();
  // The empty list offers no button: «Создать › Ученик» in the rail (232.2).
  await create(page, 'Ученик');
  await page.getByLabel('Имя и фамилия').fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Сохранить' }).click();

  const link = page.getByRole('textbox', { name: 'Ссылка-приглашение' });
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
  // the top strip shows the avatar only (0.21.0); the name is its accessible name
  await expect(
    page.getByRole('button', { name: `${STUDENT_NAME}: меню пользователя` }),
  ).toBeVisible();
});

test('the teacher gives homework and the student hands it in', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Задания' })
    .click();
  // «Создать › Задание» in the rail (232.2)
  await create(page, 'Задание');
  // The editor page (0.14.0).
  await page.locator('#editor-title').fill(HOMEWORK_TITLE);
  await page.locator('#editor-text').fill('1. Сложите 1/2 и 1/3');
  // PrimeNG puts the id on a hidden input; the component itself opens the list.
  await page.locator('p-multiselect:has(#editor-students)').click();
  await page.getByRole('option', { name: STUDENT_NAME }).click();
  await page.keyboard.press('Escape');
  await page
    .locator('tb-page-header')
    .getByRole('button', { name: /Выдать$/ })
    .click();
  await expect(page.getByRole('heading', { name: HOMEWORK_TITLE })).toBeVisible();
  const studentRow = page
    .getByRole('list', { name: 'Ученики' })
    .getByRole('listitem')
    .filter({ hasText: STUDENT_NAME });
  await expect(studentRow).toContainText('Выдано');

  const student = await studentPage(browser);
  await student
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Задания' })
    .click();
  await student.getByRole('link', { name: HOMEWORK_TITLE }).click();
  await student.locator('#answer-text').fill('1/2 + 1/3 = 5/6');
  await student.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(student.getByText('1/2 + 1/3 = 5/6')).toBeVisible();

  await page.reload();
  await expect(studentRow).toContainText('На проверке');
});

test('a payment reaches the student inbox', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Оплаты' })
    .click();
  await page.getByRole('button', { name: `Записать оплату: ${STUDENT_NAME}` }).click();
  await page.locator('#payment-amount').pressSequentially('3000');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: STUDENT_NAME })).toContainText('3 000');

  const student = await studentPage(browser);
  await student
    .locator('tb-notification-bell')
    .getByRole('button', { name: /^Уведомления/ })
    .click();
  // the bell opens its side sheet with the inbox (0.22.0)
  const sheet = student.getByRole('dialog', { name: 'Уведомления' });
  await expect(sheet.getByText('Получена оплата 3 000 ₽')).toBeVisible({ timeout: 20_000 });
  await expect(sheet.getByText(`Новое задание: «${HOMEWORK_TITLE}»`)).toBeVisible();
});

test('a lesson marked in the schedule is charged', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await planLesson(page, -1, 10, 'Повторение');

  await page.getByRole('button', { name: `Проведено: ${STUDENT_NAME}` }).click();
  await expect(page.getByRole('button', { name: `Проведено: ${STUDENT_NAME}` })).toBeHidden();

  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Оплаты' })
    .click();
  await expect(page.getByRole('listitem').filter({ hasText: STUDENT_NAME })).toContainText('1 500');
  await page.getByRole('link', { name: STUDENT_NAME }).click();
  // 0.23.0: the history is the Оплаты tab of the student's card
  await expect(page).toHaveURL(/\/teacher\/students\/[^/?]+\?tab=payments$/);
  await expect(
    page.locator('ul.tb-list[aria-label="История"]').getByText('Повторение'),
  ).toBeVisible();
});

test('the student moves a lesson when the teacher agrees', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  // The student's list of upcoming lessons shows this week only.
  const lesson = laterThisWeek(15);
  await planLesson(page, lesson.days, lesson.hours, 'Проценты');

  const student = await studentPage(browser);
  await student
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Расписание' })
    .click();
  // the home page has «Перенести» too: the click waits for the schedule
  await expect(student).toHaveURL(/\/cabinet\/schedule$/);
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
  // 0.15.1: an answered request is under «Решённые»
  await student.getByRole('button', { name: 'Решённые' }).click();
  await expect(student.getByText('Согласовано')).toBeVisible();
});

test('the home pages sum up the day', async ({ page, browser }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await expect(page.getByText('Нужно сделать')).toBeVisible();
  await expect(page.getByText(/Поступило за/)).toBeVisible();

  const student = await studentPage(browser);
  // 0.15.1: the title of the nearest lesson is for screen readers only
  await expect(student.getByRole('heading', { name: 'Ближайшее занятие' })).toHaveCount(1);
  await expect(student.getByText('Проценты')).toBeVisible();
  await expect(student.getByText('аванс 1 500 ₽')).toBeVisible();
  await expect(student.getByText('Открытых заданий нет')).toBeVisible();
});
