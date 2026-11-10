import { startSession } from '../support/session';
import { expect, test, type Page } from '@playwright/test';

/**
 * Version 0.18.0: backups are kept TEACHERBOX_BACKUP_KEEP_DAYS days (14 by default) instead of a number of
 * copies; the database starts from one migration per module. "teacherbox reset" works on the server only.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await startSession(page, login, password);
}

test('the administrator sees how many days backups are kept', async ({ page }) => {
  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/admin/settings');

  const days = page.locator('#setting-TEACHERBOX_BACKUP_KEEP_DAYS');
  await expect(days).toBeVisible();
  await expect(page.locator('.tb-setting').filter({ has: days })).toContainText(
    'Хранить дней',
  );
});

test('the teacher reads that backups are kept two weeks', async ({ page }) => {
  await signIn(page, 'teacher', TEACHER_PASSWORD);
  await page.goto('/teacher/settings?open=data');

  // 357.5: the note shows with the list, so make a copy first
  await page.getByRole('button', { name: 'Создать сейчас', exact: true }).click();
  await expect(page.getByText(/^Копия .+ создана$/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('копии хранятся две недели')).toBeVisible();
});
