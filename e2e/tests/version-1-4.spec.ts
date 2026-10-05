import { type Page, expect, test } from '@playwright/test';

/**
 * Version 1.4: the header kept at the top, the theme, the color and logo of the portal; on a phone
 * the bottom navigation, the quick actions, full-screen dialogs, cards instead of tables, the
 * schedule as a day list with «+» and the student's cabinet.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8091';
const RUN = Date.now().toString(36);
const STUDENT = `Лиза ${RUN}`;
const STUDENT_LOGIN = `liza-${RUN}`;
const STUDENT_PASSWORD = 'e2e-student-pass-14';
const PHONE = { width: 375, height: 812 };
const LOGO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="teal"/></svg>',
);

test.describe.configure({ mode: 'serial' });

let inviteLink = '';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  // The next page opened before the sign-in finishes would lead back to the sign-in page.
  await expect(page).not.toHaveURL(/\/login/);
}

/** Nothing sticks out to the right: the page does not scroll sideways. */
async function expectNoSideScroll(page: Page): Promise<void> {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(PHONE.width);
}

test.describe('on a computer', () => {
  test('the header stays at the top and the theme is remembered', async ({ page }) => {
    await signIn(page, 'teacher', TEACHER_PASSWORD);
    await page.goto('/teacher/help/first-steps');
    await page.mouse.wheel(0, 3000);
    await expect
      .poll(async () => (await page.locator('.tb-shell__header').boundingBox())?.y)
      .toBe(0);

    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitem', { name: 'Тёмная тема' }).click();
    await expect(page.locator('html')).toHaveClass(/tb-dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/tb-dark/);

    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitem', { name: 'Светлая тема' }).click();
    await expect(page.locator('html')).not.toHaveClass(/tb-dark/);
  });

  test('the portal gets its color and logo, also on the sign-in page', async ({
    page,
    browser,
  }) => {
    await signIn(page, 'teacher', TEACHER_PASSWORD);
    await page.goto('/teacher/settings');
    const card = page.locator('#portal');
    await card.getByRole('radio', { name: 'Изумрудный' }).click();
    await card.getByRole('button', { name: 'Сохранить' }).click();
    await card
      .getByLabel('Файл логотипа')
      .setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: LOGO });
    await expect(page.locator('.tb-shell__brand img')).toBeVisible();

    await page.reload();
    await expect(
      page.locator('#portal').getByRole('radio', { name: 'Изумрудный' }),
    ).toHaveAttribute('aria-checked', 'true');

    const guest = await (await browser.newContext({ baseURL: BASE_URL })).newPage();
    await guest.goto('/login');
    await expect(guest.locator('main img')).toBeVisible();
    await guest.context().close();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the teacher finds the sections below and adds a student from the home page', async ({
    page,
  }) => {
    await signIn(page, 'teacher', TEACHER_PASSWORD);
    const nav = page.locator('nav.tb-bottom-nav');
    await expect(nav.getByRole('link')).toHaveText(['Главная', 'Расписание', 'Ученики', 'Задания']);
    await nav.getByRole('button', { name: 'Ещё разделы' }).click();
    await expect(page.getByRole('menuitem', { name: 'Оплаты' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Уведомления' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expectNoSideScroll(page);

    await page.getByRole('link', { name: 'Ученик', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Новый ученик' });
    await expect(dialog).toBeVisible();
    await expect.poll(async () => (await dialog.boundingBox())?.width).toBe(PHONE.width);
    await dialog.getByLabel('Имя и фамилия').fill(STUDENT);
    await dialog.getByRole('button', { name: 'Сохранить' }).click();
    const link = page.getByRole('textbox', { name: 'Ссылка-приглашение' });
    await expect(link).toHaveValue(/\/invite\//);
    inviteLink = await link.inputValue();
    await page.keyboard.press('Escape');

    await expect(page.locator('thead').first()).toBeHidden();
    const card = page.locator('tbody tr').filter({ hasText: STUDENT });
    // 1.7.3: the status is in the details of the card
    await expect(card.locator('td[data-label="Статус"]')).toHaveCount(0);
    await card.getByRole('button', { name: `Подробнее: ${STUDENT}` }).click();
    await expect(card.locator('td[data-label="Статус"]')).toBeVisible();
    await expectNoSideScroll(page);
  });

  test('the schedule is a day list with the FAB for a new lesson', async ({ page }) => {
    await signIn(page, 'teacher', TEACHER_PASSWORD);
    await page.locator('nav.tb-bottom-nav').getByRole('link', { name: 'Расписание' }).click();
    await expect(page.getByRole('tab', { name: 'Список' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expectNoSideScroll(page);

    // The main action is the extended FAB «Занятие» (ADR-0018)
    await page.locator('p-button.tb-page-fab').getByRole('button', { name: 'Занятие' }).click();
    const dialog = page.getByRole('dialog', { name: 'Новое занятие' });
    await expect(dialog).toBeVisible();
    await expect.poll(async () => (await dialog.boundingBox())?.height).toBe(PHONE.height);
    await dialog.getByRole('button', { name: 'Отмена' }).click();
  });

  test('the student uses the cabinet from a phone', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE });
    const page = await context.newPage();
    await page.goto(inviteLink);
    await page.getByLabel('Логин').fill(STUDENT_LOGIN);
    await page.locator('#password').fill(STUDENT_PASSWORD);
    await page.locator('#confirm').fill(STUDENT_PASSWORD);
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();

    await expect(page).toHaveURL(/\/cabinet$/);
    // five sections since 1.7.0 («Мои доски»): they fit without «Ещё»
    await expect(page.locator('nav.tb-bottom-nav').getByRole('link')).toHaveCount(5);
    await expectNoSideScroll(page);
    for (const section of ['Расписание', 'Задания']) {
      await page.locator('nav.tb-bottom-nav').getByRole('link', { name: section }).click();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoSideScroll(page);
    }
    await context.close();
  });
});
