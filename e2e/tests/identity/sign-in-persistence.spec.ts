import { expect, test } from '@playwright/test';

/**
 * Version 0.13.1: module migrations run on a connection outside the pool, so H2 check constraints of altered
 * tables keep working once the pool replaces its connections. The pool's max lifetime is too long for E2E;
 * the spec checks that sign-in, which writes `identity.users` (failed attempts, `status`), still works —
 * `ModuleMigrationsTest` covers the replaced connections.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';

test('a failed and then a successful sign-in update the user', async ({ request }) => {
  const failed = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: `${TEACHER_PASSWORD}-wrong` },
  });
  expect(failed.status()).toBe(401);

  const signedIn = await request.post('/api/auth/login', {
    data: { login: 'teacher', password: TEACHER_PASSWORD },
  });
  expect(signedIn.ok()).toBe(true);
  const { accessToken } = (await signedIn.json()) as { accessToken: string };

  const me = await request.get('/api/me', { headers: { Authorization: `Bearer ${accessToken}` } });
  expect(me.ok()).toBe(true);
});
