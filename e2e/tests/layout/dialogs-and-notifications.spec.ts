import { startSession } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';
import { create } from '../support/create';

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
  await startSession(page, 'teacher', TEACHER_PASSWORD);
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
  // 0.16.2: a dialog is surface-container-high (M3), no longer the colour of a card (0.23.0: the pane)
  expect(await style(page, '.p-dialog', 'background-color')).not.toBe(
    await style(page, 'main tb-pane', 'background-color'),
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

  // 0.23.0: the students are panes (28 px), the cards of the schedule keep 20 px
  expect(await style(page, 'main tb-pane', 'border-radius')).toBe('28px');
  // 0.24.0: the schedule is panes too (28 px)
  await page.goto('/teacher/schedule');
  expect(await style(page, 'main tb-pane', 'border-radius')).toBe('28px');
});

test('repetition is configured from the same lesson form (0.29.0)', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/schedule');
  await create(page, 'Занятие');
  const dialog = page.getByRole('dialog', { name: 'Новое занятие', exact: true });
  await expect(dialog.getByLabel('Повтор', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Регулярные', exact: true })).toHaveCount(0);
});
