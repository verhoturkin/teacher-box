import { type APIRequestContext, type Page, expect } from '@playwright/test';

/** Each call creates a new session: rotated refresh cookies must not be shared between tests. */
export async function bearer(
  request: APIRequestContext,
  login = 'teacher',
  password = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass',
): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', { data: { login, password } });
  expect(response.ok(), `Sign in as ${login}`).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

/** Prepare a browser through its own cookie jar; UI sign-in is covered by the identity journeys. */
export async function startSession(page: Page, login: string, password: string): Promise<void> {
  await bearer(page.request, login, password);
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/);
}
