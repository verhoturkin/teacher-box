import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 1.6.6: Material 3 Expressive and the meaning of button colors (ADR-0019) — confirming
 * buttons are green, cancelling and deleting ones red, dialogs are white like cards, the side
 * navigation has room between its items, the top bar no longer names the area, a weekly schedule
 * ends with a bin and the teacher's notifications are folding cards instead of tabs.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const DESKTOP = { width: 1440, height: 900 };

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto('/login');
  await page.getByLabel('Логин').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function teacherToken(request: APIRequestContext): Promise<string> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { accessToken: string }).accessToken;
}

function style(page: Page, selector: string, property: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
}

test('the teacher notifications are cards: the inbox and the messages open, the settings folded', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/notifications');

  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('#notifications-inbox')).toContainText('Входящие');
  await expect(page.locator('#notifications-messages')).toContainText('Написать ученикам');
  for (const section of ['messengers', 'students', 'preferences']) {
    await expect(
      page.locator(`#notifications-${section}`).getByRole('button', { expanded: false }),
    ).toBeVisible();
  }
  await expect(page.getByText('Мои мессенджеры')).toHaveCount(0);

  await page.locator('#notifications-messengers').getByRole('button', { expanded: false }).click();
  await expect(page).toHaveURL(/open=messengers/);
  await expect(page.getByText('Мои мессенджеры')).toBeVisible();

  // A link of the former tabs opens its section.
  await page.goto('/teacher/notifications?tab=students');
  await expect(
    page.locator('#notifications-students').getByRole('button', { expanded: true }),
  ).toBeVisible();
  await expect(page.locator('#notifications-students')).toContainText('Подключили мессенджер');
});

test('confirming buttons are green, cancelling red, and the dialog is white like a card', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/students');
  await page.getByRole('button', { name: 'Добавить ученика' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Новый ученик' });
  await expect(dialog).toBeVisible();

  await expect(dialog.getByRole('button', { name: 'Сохранить' })).toHaveClass(/p-button-success/);
  const cancel = dialog.getByRole('button', { name: 'Отмена' });
  await expect(cancel).toHaveClass(/p-button-danger/);
  await expect(cancel).toHaveClass(/p-button-text/);
  expect(await style(page, '.p-dialog', 'background-color')).toBe(
    await style(page, 'main .p-card', 'background-color'),
  );
  await cancel.click();
  await expect(dialog).toBeHidden();
});

test('the frame: room between the sections, no name of the area, Expressive shapes', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/students');

  const items = page.locator('tb-side-nav .p-menu-item');
  const first = await items.nth(0).boundingBox();
  const second = await items.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect((second?.y ?? 0) - ((first?.y ?? 0) + (first?.height ?? 0))).toBeGreaterThanOrEqual(4);

  const header = page.locator('header.tb-shell__header');
  await expect(header).not.toContainText('Кабинет учителя');
  await expect(header).toContainText('Teacher Box');

  expect(await style(page, 'main .p-card', 'border-radius')).toBe('20px');
  expect(await style(page, 'p-button.tb-page-fab .p-button', 'border-radius')).toBe('20px');
});

test('a weekly schedule ends with a bin, red like deleting off time', async ({ page, request }) => {
  const token = await teacherToken(request);
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: 'Ученик серии 1.6.6', email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { student } = (await created.json()) as { student: { id: string } };
  const series = await request.post('/api/teacher/schedule/series', {
    headers,
    data: {
      studentId: student.id,
      groupId: null,
      weekdays: ['WEDNESDAY'],
      startTime: '18:00',
      durationMinutes: 60,
      intervalWeeks: 1,
      startsOn: new Date().toISOString().slice(0, 10),
      endsOn: null,
      topic: null,
      meetingUrl: null,
    },
  });
  expect(series.ok()).toBe(true);

  await signIn(page);
  await page.goto('/teacher/schedule');
  const end = page.getByRole('button', { name: 'Завершить расписание: Ученик серии 1.6.6' });
  await expect(end).toBeVisible();
  await expect(end).toHaveClass(/p-button-danger/);
  await expect(end.locator('.pi-trash')).toHaveCount(1);
  await expect(end.locator('.pi-stop-circle')).toHaveCount(0);
});
