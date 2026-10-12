import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.11.1: the server writes in the user's language — the language chosen in the interface is
 * kept in the account, and notifications, bot messages and calendars follow it; the administrator's
 * texts follow the language of the page.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

test.describe.configure({ mode: 'serial' });

async function teacher(request: APIRequestContext): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

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
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect.poll(() => accountLanguage(request)).toBe('en');

  await page.getByRole('button', { name: /user menu/ }).click();
  await page.getByRole('menuitem', { name: 'Русский' }).click();
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
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
