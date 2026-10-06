import { type APIRequestContext, type Page, expect, test } from '@playwright/test';

/**
 * Version 0.9.0: ready images, the installer and HTTPS in the box (ADR-0032). The instance under test is built
 * by compose.yaml + compose.build.yaml, so these checks also cover the new compose files; in the portal the
 * administrator sees the new Docker setting TEACHERBOX_DOMAIN, read-only like the other Docker settings.
 */

const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';

interface SettingView {
  name: string;
  section: string;
  title: string;
  access: string;
}

async function adminBearer(request: APIRequestContext): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', {
    data: { login: 'admin', password: ADMIN_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('the portal built from compose.yaml + compose.build.yaml serves the SPA, the API and /livekit', async ({
  request,
}) => {
  expect((await request.get('/healthz')).ok()).toBe(true);
  const health = await request.get('/actuator/health');
  expect(health.ok()).toBe(true);
  expect(((await health.json()) as { status: string }).status).toBe('UP');
  const spa = await request.get('/login');
  expect(spa.ok()).toBe(true);
  expect(await spa.text()).toContain('<tb-root');
  // LiveKit from the inline config (LIVEKIT_CONFIG) answers through the nginx of the frontend.
  expect((await request.get('/livekit/')).status()).toBeLessThan(500);
});

test('TEACHERBOX_DOMAIN is a Docker setting the administrator only sees', async ({
  request,
  page,
}) => {
  const response = await request.get('/api/admin/settings', {
    headers: await adminBearer(request),
  });
  expect(response.ok()).toBe(true);
  const { settings } = (await response.json()) as { settings: SettingView[] };
  const domain = settings.find((setting) => setting.name === 'TEACHERBOX_DOMAIN');
  expect(domain).toMatchObject({
    section: 'docker',
    access: 'DOCKER',
    title: 'Домен портала для HTTPS (Caddy)',
  });

  await signIn(page, 'admin', ADMIN_PASSWORD);
  await page.goto('/admin/settings?open=docker');
  const setting = page
    .locator('.tb-setting')
    .filter({ hasText: 'Домен портала для HTTPS (Caddy)' });
  await expect(setting).toBeVisible();
  // Docker settings have no input: a box icon and the note above the group.
  await expect(setting.locator('.pi-box')).toBeVisible();
  await expect(setting.locator('input')).toHaveCount(0);
  await expect(page.getByText('Docker Compose читает её до запуска портала').first()).toBeVisible();
});
