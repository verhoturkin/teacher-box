import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { create } from './create';

/**
 * Version 0.6.6: Material 3 Expressive and the meaning of button colors (ADR-0019; since 0.17.0 one
 * accent, ADR-0045 — confirming buttons are primary, red only deletes), dialogs are white like cards, the side
 * navigation has room between its items, the top bar no longer names the area, a weekly schedule
 * ends with a red button (a stop sign since 0.6.12, DA-066) and the teacher's notifications are folding cards instead of tabs.
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

test('the teacher notifications are in the bell: the inbox and the messages; the messengers are in the settings', async ({
  page,
}) => {
  await signIn(page);
  // 0.22.0: the old page leads home with the bell's sheet open, its tabs «Входящие» and «Отправленные» (235.1)
  await page.goto('/teacher/notifications');
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole('tab', { name: /^Входящие/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Отправленные' }).click();
  await expect(page.getByRole('button', { name: 'Написать ученикам' })).toBeVisible();
  await expect(page.getByText('Мои мессенджеры')).toHaveCount(0);

  // 0.22.0: links of the former tabs and folded sections lead to the category «Мессенджеры» (234.3)
  for (const old of ['?tab=students', '?open=messengers']) {
    await page.goto(`/teacher/notifications${old}`);
    await expect(page).toHaveURL(/\/teacher\/settings\/messengers$/);
    await expect(page.locator('tb-student-messengers-panel')).toContainText(
      'Подключили мессенджер',
    );
    await expect(page.getByText('Мои мессенджеры')).toBeVisible();
  }
});

test('confirming buttons are primary, cancelling neutral, and the dialog stands apart from a card', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/teacher/students');
  await create(page, 'Ученик');
  const dialog = page.getByRole('dialog', { name: 'Новый ученик' });
  await expect(dialog).toBeVisible();

  // 0.17.0: one accent (ADR-0045) — the submit is filled primary, never green
  const save = dialog.getByRole('button', { name: 'Сохранить' });
  await expect(save).not.toHaveClass(/p-button-(success|secondary|text|danger)/);
  const cancel = dialog.getByRole('button', { name: 'Отмена' });
  await expect(cancel).toHaveClass(/p-button-secondary/);
  await expect(cancel).toHaveClass(/p-button-text/);
  // 0.16.2: a dialog is surface-container-high (M3), no longer the colour of a card
  expect(await style(page, '.p-dialog', 'background-color')).not.toBe(
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

  const items = page.locator('tb-side-nav li');
  const first = await items.nth(0).boundingBox();
  const second = await items.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect((second?.y ?? 0) - ((first?.y ?? 0) + (first?.height ?? 0))).toBeGreaterThanOrEqual(4);

  const header = page.locator('header.tb-shell__header');
  await expect(header).not.toContainText('Кабинет учителя');
  // the name of the portal at the top of the rail (231.1; other scenarios rename it)
  await expect(page.locator('tb-side-nav .tb-side-nav__brand')).not.toBeEmpty();

  expect(await style(page, 'main .p-card', 'border-radius')).toBe('20px');
  // the main action of a section outside «Создать» (232.2): the header button of the textbooks
  await page.goto('/teacher/textbooks');
  expect(await style(page, 'p-button.tb-page-fab .p-button', 'border-radius')).toBe('20px');
});

test('a weekly schedule ends with a red stop sign, not a bin (DA-066)', async ({
  page,
  request,
}) => {
  const token = await teacherToken(request);
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName: 'Ученик серии 0.6.6', email: null, phone: null, note: null },
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
      // lessons of other specs may stand at this hour on the day of the run
      allowOverlap: true,
    },
  });
  expect(series.ok()).toBe(true);

  await signIn(page);
  await page.goto('/teacher/schedule');
  // 0.15.3: the actions of recurring lessons are in «⋮»
  await page.getByRole('button', { name: 'Действия: Ученик серии 0.6.6' }).click();
  const end = page.getByRole('menuitem', { name: 'Завершить…' });
  await expect(end).toBeVisible();
  await expect(end.locator('xpath=ancestor-or-self::li')).toHaveClass(/tb-menu-item--danger/);
  await expect(end.locator('.tb-i-stop_circle')).toHaveCount(1);
  await expect(end.locator('.tb-i-delete')).toHaveCount(0);
});
