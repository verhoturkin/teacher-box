import { bearer as teacher, startSession } from '../support/session';
import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.11.1: the server writes in the user's language — the language chosen in the interface is
 * kept in the account, and notifications, bot messages and calendars follow it; the administrator's
 * texts follow the language of the page.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

test.describe.configure({ mode: 'serial' });

async function accountLanguage(request: APIRequestContext): Promise<string> {
  const me = await request.get('/api/me', { headers: await teacher(request) });
  expect(me.ok()).toBe(true);
  return ((await me.json()) as { language: string }).language;
}

async function signIn(page: Page, button: string): Promise<void> {
  await page.locator('#login').fill('teacher');
  await page.locator('#password').fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: button }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('the language chosen in the interface goes to the account', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'English' }).click();
  await signIn(page, 'Sign in');
  await expect(page.getByRole('region', { name: 'Today', exact: true })).toBeVisible();
  await expect.poll(() => accountLanguage(request)).toBe('en');

  await page.goto('/teacher/settings/account');
  await page.getByRole('button', { name: 'Русский' }).click();
  await expect.poll(() => accountLanguage(request)).toBe('ru');
  await page.goto('/teacher');
  await expect(page.getByRole('region', { name: 'Сегодня', exact: true })).toBeVisible();
  await expect.poll(() => accountLanguage(request)).toBe('ru');
});

test("the calendar feed is written in its owner's language", async ({ request }) => {
  const headers = await teacher(request);
  const feed = await request.post('/api/me/schedule/feed', { headers });
  expect(feed.ok()).toBe(true);
  const { path } = (await feed.json()) as { path: string };

  const english = await request.put('/api/me/language', { headers, data: { language: 'en' } });
  expect(english.ok()).toBe(true);
  try {
    const ics = await (await request.get(path)).text();
    expect(ics.replace(/\r\n /g, '')).toContain(' — lessons');
  } finally {
    await request.put('/api/me/language', { headers, data: { language: 'ru' } });
  }
  expect((await (await request.get(path)).text()).replace(/\r\n /g, '')).toContain(' — занятия');
});

test('the account item opens «Мой аккаунт»: theme switch and sign out', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await startSession(page, 'teacher', TEACHER_PASSWORD);
  await page.locator('a[aria-label^="Аккаунт"]').click();
  await expect(page).toHaveURL(/\/teacher\/settings\/account$/);
  await page.getByRole('button', { name: 'Тёмная' }).click();
  await expect(page.locator('html')).toHaveClass(/tb-dark/);
  await page.getByRole('button', { name: 'Светлая' }).click();
  await expect(page.locator('html')).not.toHaveClass(/tb-dark/);
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});
