import { bearer, startSession } from '../support/session';
import { type APIRequestContext, expect, test } from '@playwright/test';

/**
 * Stage 363 (ADR-0056): the teacher's lesson settings live in the portal and apply at once, without a restart;
 * an old variable (TEACHERBOX_PUBLIC_URL in compose.e2e.yaml) was imported once and is no longer read.
 */

const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';
const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8091';

interface LessonRules {
  defaultDurationMinutes: number;
  lateCancellationMinutes: number;
  reminderMinutes: number[];
  horizonWeeks: number;
}

interface AdminSettings {
  settings: { name: string }[];
  moved: { name: string; source: string }[];
  startedAt: string;
}

async function adminSettings(request: APIRequestContext): Promise<AdminSettings> {
  const headers = await bearer(request, 'admin', ADMIN_PASSWORD);
  const response = await request.get('/api/admin/settings', { headers });
  expect(response.ok()).toBe(true);
  return (await response.json()) as AdminSettings;
}

test('reminders and the time zone change without a restart', async ({ page, request }) => {
  const headers = await bearer(request);
  const started = (await adminSettings(request)).startedAt;

  const before = await request.get('/api/teacher/schedule/settings', { headers });
  expect(before.ok()).toBe(true);
  const rules = (await before.json()) as LessonRules;
  const current = await request.get('/api/me/schedule/settings', { headers });
  const zoneBefore = ((await current.json()) as { timeZone: string }).timeZone;

  try {
    const changed = await request.put('/api/teacher/schedule/settings', {
      headers,
      data: { ...rules, reminderMinutes: [1440, 60] },
    });
    expect(changed.ok()).toBe(true);
    expect(((await changed.json()) as LessonRules).reminderMinutes).toEqual([1440, 60]);
    const reread = await request.get('/api/teacher/schedule/settings', { headers });
    expect(((await reread.json()) as LessonRules).reminderMinutes).toEqual([1440, 60]);

    const zone = zoneBefore === 'Asia/Yekaterinburg' ? 'Europe/Kaliningrad' : 'Asia/Yekaterinburg';
    const zoneResponse = await request.put('/api/teacher/settings/time-zone', {
      headers,
      data: { timeZone: zone },
    });
    expect(zoneResponse.ok()).toBe(true);
    const schedule = await request.get('/api/me/schedule/settings', { headers });
    expect(((await schedule.json()) as { timeZone: string }).timeZone).toBe(zone);

    // the settings page shows the new zone
    await startSession(page, 'teacher', TEACHER_PASSWORD);
    await page.goto('/teacher/settings/lessons');
    await expect(page.locator('#time-zone')).toContainText(zone);

    // no restart: the portal that answered before still runs
    expect((await adminSettings(request)).startedAt).toBe(started);
  } finally {
    await request.put('/api/teacher/schedule/settings', { headers, data: rules });
    await request.put('/api/teacher/settings/time-zone', { headers, data: { timeZone: zoneBefore } });
  }
});

test('an old variable was imported once and is only listed as moved', async ({ request }) => {
  // compose.e2e.yaml still sets TEACHERBOX_PUBLIC_URL: the first start copied it into the portal address
  const portal = await request.get('/api/public/portal');
  expect(((await portal.json()) as { address: string | null }).address).toBe(BASE_URL);

  const settings = await adminSettings(request);
  expect(settings.moved.map((item) => item.name)).toContain('TEACHERBOX_PUBLIC_URL');
  // it is the teacher's setting now: not in the administrator's list, and no value leaks
  expect(settings.settings.map((item) => item.name)).not.toContain('TEACHERBOX_PUBLIC_URL');
  expect(JSON.stringify(settings.moved)).not.toContain(BASE_URL);
});
