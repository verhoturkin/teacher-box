import { startSession, bearer } from '../support/session';
import { type APIRequestContext, expect, test } from '@playwright/test';

/**
 * Installable app and web push (ADR-0051): the service worker files are revalidated, the devices REST,
 * and the devices card in «Мой аккаунт». Real delivery through a push service stays a manual check.
 */

const RUN = Date.now().toString(36);
const LOGIN = `push-${RUN}`;
const OTHER = `push-other-${RUN}`;
const PASSWORD = 'student-pass-1';

test.describe.configure({ mode: 'serial' });

async function addStudent(request: APIRequestContext, name: string, login: string): Promise<void> {
  const created = await request.post('/api/teacher/students', {
    headers: await bearer(request),
    data: { displayName: name, email: null, phone: null, note: null },
  });
  expect(created.ok()).toBe(true);
  const { invite } = (await created.json()) as { invite: { token: string } };
  const accepted = await request.post(`/api/auth/invites/${invite.token}/accept`, {
    data: { login, password: PASSWORD },
  });
  expect(accepted.ok()).toBe(true);
}

function subscription(): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const base64url = (bytes: number): string => Buffer.alloc(bytes, 7).toString('base64url');
  return {
    endpoint: `https://push.example.com/e2e/${RUN}-${Math.random().toString(36).slice(2)}`,
    keys: { p256dh: base64url(65), auth: base64url(16) },
  };
}

test.beforeAll(async ({ request }) => {
  await addStudent(request, `Ученик с push ${RUN}`, LOGIN);
  await addStudent(request, `Другой ученик с push ${RUN}`, OTHER);
});

test('the service worker files are never cached and the worker takes control', async ({
  page,
  request,
}) => {
  for (const file of ['/ngsw.json', '/ngsw-worker.js']) {
    const response = await request.get(file);
    expect(response.ok(), file).toBe(true);
    expect(response.headers()['cache-control'], file).toContain('no-cache');
  }
  const home = await request.get('/');
  expect(home.headers()['content-security-policy']).toContain("worker-src 'self'");

  await startSession(page, LOGIN, PASSWORD);
  await expect
    .poll(() =>
      page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state),
    )
    .toBe('activated');
});

test('devices REST: a public key, subscribe, list, own delete, another user gets 404', async ({
  request,
}) => {
  const student = await bearer(request, LOGIN, PASSWORD);
  const other = await bearer(request, OTHER, PASSWORD);

  const key = await request.get('/api/me/push/key', { headers: student });
  expect(((await key.json()) as { key: string }).key.length).toBeGreaterThan(50);

  const created = await request.post('/api/me/push/subscriptions', {
    headers: student,
    data: subscription(),
  });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };

  const listed = await request.get('/api/me/push/subscriptions', { headers: student });
  const devices = (await listed.json()) as { id: string }[];
  expect(devices.map((d) => d.id)).toContain(id);
  expect(JSON.stringify(devices)).not.toContain('push.example.com');
  const othersList = await request.get('/api/me/push/subscriptions', { headers: other });
  expect(await othersList.json()).toEqual([]);

  const foreign = await request.delete(`/api/me/push/subscriptions/${id}`, { headers: other });
  expect(foreign.status()).toBe(404);
  const own = await request.delete(`/api/me/push/subscriptions/${id}`, { headers: student });
  expect(own.ok()).toBe(true);
  const after = await request.get('/api/me/push/subscriptions', { headers: student });
  expect(await after.json()).toEqual([]);

  const broken = await request.post('/api/me/push/subscriptions', {
    headers: student,
    data: { ...subscription(), endpoint: 'http://push.example.com/insecure' },
  });
  expect(broken.status()).toBe(422);
});

test('«Мой аккаунт»: the permission is granted, the card offers to enable and lists «Отключить»', async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(['notifications']);
  await page.setViewportSize({ width: 1280, height: 900 });
  await startSession(page, LOGIN, PASSWORD);
  const headers = await bearer(request, LOGIN, PASSWORD);
  const created = await request.post('/api/me/push/subscriptions', {
    headers,
    data: subscription(),
  });
  expect(created.ok()).toBe(true);

  await page.goto('/cabinet/account');
  const card = page.locator('p-card', {
    has: page.getByText('Уведомления на устройствах', { exact: true }),
  });
  await expect(card).toBeVisible();
  await expect(
    card.getByRole('button', { name: 'Включить уведомления на этом устройстве' }),
  ).toBeVisible();
  await expect(card.getByRole('listitem')).toHaveCount(1);

  await card.getByRole('button', { name: /^Отключить уведомления/ }).click();
  await expect(card.getByRole('listitem')).toHaveCount(0);
  const list = await request.get('/api/me/push/subscriptions', { headers });
  expect(await list.json()).toEqual([]);
});
