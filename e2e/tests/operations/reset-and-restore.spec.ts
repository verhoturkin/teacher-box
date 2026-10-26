import { startSession } from '../support/session';
import { type Page, expect, test } from '@playwright/test';
import { create } from '../support/create';

/**
 * Version 0.3: the name of the portal in the header and its address in the invitation link, a backup
 * made by the administrator, the full reset with the first setup after it, and restoring the backup
 * by the administrator (the container restarts) that brings the data back.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8091';
const RUN = Date.now().toString(36);
const PORTAL_NAME = `Школа ${RUN}`;
const STUDENT = `Вера ${RUN}`;

test.describe.configure({ mode: 'serial' });

let backupRow = '';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

test('the portal has its name and gives out links with its address', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await expect(page).toHaveURL(/\/teacher$/);

  await page.goto('/teacher/settings?open=portal');
  const card = page.locator('#portal');
  await card.locator('#portal-name').fill(PORTAL_NAME);
  await card.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.locator('.tb-side-nav__brand')).toContainText(PORTAL_NAME);
  // 234.1: the category is part of the title
  await expect(page).toHaveTitle(`Портал — Настройки — ${PORTAL_NAME}`);

  await page.goto('/teacher/students');
  await create(page, 'Ученик');
  await page.getByLabel('Имя и фамилия').fill(STUDENT);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('textbox', { name: 'Ссылка-приглашение' })).toHaveValue(
    new RegExp(`^${BASE_URL}/invite/`),
  );
});

test('the administrator makes a backup', async ({ page }) => {
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Копии' })
    .click();
  await expect(page.getByRole('heading', { name: 'Копии', level: 1 })).toBeVisible();
  const created = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/admin/backups',
  );
  await page.getByRole('button', { name: 'Создать копию сейчас' }).click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const backup = (await response.json()) as { name: string };
  backupRow = `Действия: ${backup.name}`;
  expect(backupRow).toMatch(/^Действия: teacherbox-/);
  // since 0.9.1 the actions of a backup are in its «⋮» menu; the administrator has only «Восстановить…»
  const actions = page
    .getByRole('list', { name: 'Резервные копии' })
    .getByRole('button', { name: backupRow, exact: true });
  await expect(actions).toBeVisible();
  await actions.click();
  await expect(page.getByRole('menuitem', { name: 'Восстановить…' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Скачать' })).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('the full reset deletes the data and opens the first setup', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/settings?open=data');
  await page.getByRole('button', { name: 'Сбросить все данные…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сбросить все данные?' });
  await dialog.locator('#reset-password').fill(TEACHER_PASSWORD);
  await dialog.locator('#reset-word').fill('СБРОСИТЬ');
  await dialog.getByRole('button', { name: 'Сбросить', exact: true }).click();

  await expect(page).toHaveURL(/\/teacher\/setup$/);
  await expect(page.getByRole('heading', { name: 'Первоначальная настройка' })).toBeVisible();
  await expect(page.locator('.tb-side-nav__brand')).toContainText('Teacher Box');
  await page.getByRole('button', { name: 'Далее' }).click();
  await expect(page.getByRole('heading', { name: 'Адрес портала' })).toBeVisible();
  await page.getByRole('button', { name: 'Пропустить настройку' }).click();
  await expect(page).toHaveURL(/\/teacher$/);

  await page.goto('/teacher/students');
  await expect(page.getByText('Учеников пока нет')).toBeVisible();
  await page.goto('/teacher/settings?open=data');
  await expect(
    page
      .getByRole('list', { name: 'Резервные копии' })
      .getByRole('listitem')
      .filter({ hasText: 'перед сбросом' })
      .first(),
  ).toBeVisible();
});

test('the administrator restores the backup and the data comes back', async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page
    .getByRole('navigation', { name: 'Разделы' })
    .getByRole('link', { name: 'Копии' })
    .click();
  await page.getByRole('button', { name: backupRow, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Восстановить…' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Восстановление из копии' });
  await dialog.locator('#restore-password').fill(ADMIN_PASSWORD);
  await dialog.getByRole('button', { name: 'Восстановить' }).click();
  await expect(dialog).toContainText('Портал перезапускается');
  await expect(dialog).toContainText('Копия восстановлена', { timeout: 180_000 });

  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await expect(page.locator('.tb-side-nav__brand')).toContainText(PORTAL_NAME);
  await page.goto('/teacher/students');
  await expect(page.getByText(STUDENT)).toBeVisible();
});
