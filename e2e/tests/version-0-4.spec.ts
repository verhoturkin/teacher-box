import { type Page, expect, test } from '@playwright/test';

/**
 * Version 0.4: the header kept at the top, the theme, the color and logo of the portal; on a phone
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
    await page.getByRole('menuitemradio', { name: 'Тёмная тема' }).click();
    await expect(page.locator('html')).toHaveClass(/tb-dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/tb-dark/);

    await page.getByRole('button', { name: 'Меню пользователя' }).click();
    await page.getByRole('menuitemradio', { name: 'Светлая тема' }).click();
    await expect(page.locator('html')).not.toHaveClass(/tb-dark/);
  });

  test('the portal gets its color and logo, also on the sign-in page', async ({
    page,
    browser,
  }) => {
    await signIn(page, 'teacher', TEACHER_PASSWORD);
    await page.goto('/teacher/settings?open=portal');
    const card = page.locator('#portal');
    await card.getByRole('radio', { name: 'Изумрудный' }).click();
    await card.getByRole('button', { name: 'Сохранить' }).click();
    await card
      .getByLabel('Файл логотипа')
      .setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: LOGO });
    await expect(page.locator('.tb-side-nav__brand img')).toBeVisible();

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
    // 0.21.0: five sections in the bar (D2), the rest in the modal rail under ☰ (no «Ещё»)
    await expect(nav.getByRole('link')).toHaveText([
      'Главная',
      'Расписание',
      'Задания',
      'Ученики',
      'Оплаты',
    ]);
    const menu = page.getByRole('button', { name: 'Разделы' });
    await menu.click();
    const rail = page.getByRole('dialog', { name: 'Разделы' });
    await expect(rail.getByRole('link', { name: 'Доски' })).toBeVisible();
    // 0.22.0: no «Уведомления» — the notifications are in the bell
    await expect(rail.getByRole('link', { name: 'Уведомления' })).toHaveCount(0);
    await expect(rail.getByRole('link', { name: 'Справка' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(rail).toBeHidden();
    await expect(menu).toBeFocused();
    await expectNoSideScroll(page);

    // the FAB menu «Создать» of the home page (0.15.0; the rail's six items since 232.2)
    await page.getByRole('button', { name: 'Создать' }).click();
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

    // 0.7.3: a student is a row of the list — the name and the status on the right; 0.23.0: «⋮» is in
    // the card, which replaces the list on a phone
    const card = page.locator('ul.tb-list[aria-label="Ученики"] > li').filter({ hasText: STUDENT });
    await expect(card.locator('p-tag')).toHaveText('Приглашён');
    await card.getByRole('link', { name: STUDENT }).click();
    await expect(page.getByRole('button', { name: `Действия: ${STUDENT}` })).toBeVisible();
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
    // six sections since 0.10.0 («Учебники»): five in the bar (0.21.0), «Учебники» under ☰
    const bar = page.locator('nav.tb-bottom-nav');
    await expect(bar.getByRole('link')).toHaveText([
      'Главная',
      'Расписание',
      'Задания',
      'Мои доски',
      'Оплаты',
    ]);
    await expect(bar.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Разделы' })).toBeVisible();
    await expectNoSideScroll(page);
    for (const section of ['Расписание', 'Оплаты']) {
      await page.locator('nav.tb-bottom-nav').getByRole('link', { name: section }).click();
      // on a phone a section's title is only for screen readers (0.9.2); the top app bar shows it
      await expect(page.getByRole('heading', { level: 1, name: section })).toBeAttached();
      await expect(page.locator('.tb-shell__title')).toHaveText(section);
      await expectNoSideScroll(page);
    }
    await context.close();
  });
});
