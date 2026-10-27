import { startSession, bearer } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.23.0, the student card: students and groups are one list beside the card of the chosen one; the
 * card's header writes, records a payment and plans a lesson; its tabs hold the lessons, homework, payments
 * and the profile, whose fields are edited in place; a group has its own card with its members; the old
 * address of a student's payments opens the Оплаты tab of the card.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const RUN = Date.now().toString(36);
const STUDENT = `Карточка ${RUN}`;
const RENAMED = `Карточка ${RUN} Петрова`;
const MEMBER = `Участник ${RUN}`;
const GROUP = `Группа ${RUN}`;
const WIDE = { width: 1440, height: 900 };

test.describe.configure({ mode: 'serial' });

let studentId = '';
let groupId = '';

async function signIn(page: Page): Promise<void> {
  await page.setViewportSize(WIDE);
  await startSession(page, 'teacher', TEACHER_PASSWORD);
}

async function student(
  request: APIRequestContext,
  headers: Record<string, string>,
  displayName: string,
): Promise<string> {
  const created = await request.post('/api/teacher/students', {
    headers,
    data: { displayName, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  return ((await created.json()) as { student: { id: string } }).student.id;
}

function roster(page: Page) {
  return page.locator('ul.tb-list[aria-label="Ученики"]');
}

test.beforeAll(async ({ request }) => {
  const headers = await bearer(request);
  studentId = await student(request, headers, STUDENT);
  const member = await student(request, headers, MEMBER);
  const group = await request.post('/api/teacher/groups', {
    headers,
    data: { name: GROUP, memberIds: [member] },
  });
  expect(group.ok()).toBe(true);
  groupId = ((await group.json()) as { id: string }).id;
});

test('a student opens from the list beside it, with the header and the tabs', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/students');
  await roster(page).getByRole('link', { name: STUDENT, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher/students/${studentId}`));
  // list-detail: the list stays beside the card, the row is the current one
  await expect(roster(page)).toBeVisible();
  await expect(roster(page).getByRole('link', { name: STUDENT, exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('.tb-card-head__name')).toHaveText(STUDENT);
  for (const action of ['Написать', 'Оплата', 'Занятие']) {
    await expect(
      page.locator('tb-card-head').getByRole('button', { name: action, exact: true }),
    ).toBeVisible();
  }
  await expect(page.getByRole('tab')).toHaveText([
    'Обзор',
    'Занятия',
    'Задания',
    'Оплаты',
    'Профиль',
  ]);
  await page.getByRole('tab', { name: 'Задания' }).click();
  await expect(page).toHaveURL(/\?tab=homework$/);
});

test('the profile is edited in place on the Профиль tab', async ({ page }) => {
  await signIn(page);
  await page.goto(`/teacher/students/${studentId}?tab=profile`);
  const details = page.locator('p-card', { hasText: 'Данные ученика' });
  await details.locator('#profile-name').fill(RENAMED);
  await details.locator('#profile-note').fill('Готовится к ОГЭ');
  await details.getByRole('button', { name: 'Сохранить' }).click();

  // the header and the list take the new name without a dialog
  await expect(page.locator('.tb-card-head__name')).toHaveText(RENAMED);
  await expect(roster(page).getByRole('link', { name: RENAMED, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('#profile-name')).toHaveValue(RENAMED);
  await expect(page.locator('#profile-note')).toHaveValue('Готовится к ОГЭ');
});

test('a payment is recorded from the card header and shows on Оплаты', async ({ page }) => {
  await signIn(page);
  await page.goto(`/teacher/students/${studentId}`);
  await page.locator('tb-card-head').getByRole('button', { name: 'Оплата', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#payment-amount').pressSequentially('2500');
  await dialog.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText('Оплата сохранена')).toBeVisible();

  await page.getByRole('tab', { name: 'Оплаты' }).click();
  await expect(page).toHaveURL(/\?tab=payments$/);
  const history = page.locator('ul.tb-list[aria-label="История"] > li');
  await expect(history).toHaveCount(1);
  await expect(history.first()).toContainText('+2 500 ₽');
});

test('the old address of a student’s payments opens the Оплаты tab', async ({ page }) => {
  await signIn(page);
  await page.goto(`/teacher/billing/students/${studentId}`);
  await expect(page).toHaveURL(
    (url) => url.pathname === `/teacher/students/${studentId}` && url.search === '?tab=payments',
  );
  await expect(page.getByRole('tab', { name: 'Оплаты' })).toHaveAttribute('aria-selected', 'true');
});

test('a group has its own card with the members', async ({ page }) => {
  await signIn(page);
  await page.goto('/teacher/students');
  // 0.36.1: the row counts the members instead of naming them and keeps at most two lines of text
  const row = roster(page).locator('> li', { hasText: GROUP });
  await expect(row.locator('.tb-list__supporting')).toHaveText(/^1 участник\b/);
  await expect(row).not.toContainText(MEMBER);
  await expect(row.locator('.tb-list__title')).toHaveCSS('-webkit-line-clamp', '2');
  await roster(page).getByRole('link', { name: GROUP, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/teacher/groups/${groupId}`));
  await expect(page.locator('.tb-card-head__name')).toHaveText(GROUP);
  await expect(page.getByRole('tab')).toHaveText([
    'Обзор',
    'Занятия',
    'Задания',
    'Участники',
    'Профиль',
  ]);
  await page.getByRole('tab', { name: 'Участники' }).click();
  await expect(page).toHaveURL(/\?tab=members$/);
  await expect(
    page.locator('ul.tb-list[aria-label="Участники"] > li').filter({ hasText: MEMBER }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Профиль' }).click();
  await expect(page.locator('p-card', { hasText: 'Данные группы' })).toBeVisible();
});
