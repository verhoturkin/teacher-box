import { bearer } from '../support/session';
import { type APIRequestContext, expect, test } from '@playwright/test';

/**
 * Versions 0.14.6–0.14.7: the AI request log comes by pages of 10 and is a list of cards, the teacher rewrites the
 * system prompts of the assistant and restores the standard ones (ADR-0043). The E2E instance has no AI service, so
 * the AI page hides its cards; the API works without one and is checked here, the cards — by the unit tests.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';

interface SystemPrompt {
  readonly feature: string;
  readonly text: string;
  readonly defaultText: string;
  readonly custom: boolean;
  readonly version: number;
}

test.describe.configure({ mode: 'serial' });

test('the teacher rewrites a system prompt and restores the standard one', async ({ request }) => {
  const headers = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const listed = await request.get('/api/teacher/ai/system-prompts', { headers });
  expect(listed.ok()).toBe(true);
  const prompts = (await listed.json()) as SystemPrompt[];
  expect(prompts.map((prompt) => prompt.feature)).toEqual([
    'HOMEWORK_DRAFT',
    'REVIEW_DRAFT',
    'LESSON_SUMMARY',
  ]);
  const review = prompts[1];
  if (review === undefined) {
    throw new Error('the review prompt is expected');
  }

  const saved = await request.put('/api/teacher/ai/system-prompts/REVIEW_DRAFT', {
    headers,
    data: { text: 'Проверяй строго и коротко', version: review.version },
  });
  expect(saved.ok()).toBe(true);
  const custom = (await saved.json()) as SystemPrompt;
  expect(custom).toMatchObject({ text: 'Проверяй строго и коротко', custom: true });

  const stale = await request.put('/api/teacher/ai/system-prompts/REVIEW_DRAFT', {
    headers,
    data: { text: 'Устаревшая правка', version: review.version },
  });
  expect(stale.status()).toBe(409);

  const restored = await request.delete('/api/teacher/ai/system-prompts/REVIEW_DRAFT', { headers });
  expect(restored.ok()).toBe(true);
  expect((await restored.json()) as SystemPrompt).toMatchObject({
    text: custom.defaultText,
    custom: false,
    version: 0,
  });
});

test('the AI request log comes by pages for the teacher and the administrator', async ({
  request,
}) => {
  const teacher = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const usage = await request.get('/api/teacher/ai/usage', { headers: teacher });
  expect(usage.ok()).toBe(true);
  const report = (await usage.json()) as { month: string; recent: unknown[]; moreRecent: boolean };
  expect(report.recent.length).toBeLessThanOrEqual(10);
  expect(report.moreRecent).toBe(false);

  const page = await request.get(`/api/teacher/ai/requests?month=${report.month}&offset=10`, {
    headers: teacher,
  });
  expect(page.ok()).toBe(true);
  expect(await page.json()).toEqual({ items: [], hasMore: false });

  const admin = await bearer(request, 'admin', ADMIN_PASSWORD);
  const adminPage = await request.get('/api/admin/ai/requests', { headers: admin });
  expect(adminPage.ok()).toBe(true);
  expect((await request.get('/api/teacher/ai/system-prompts', { headers: admin })).status()).toBe(
    403,
  );
});
