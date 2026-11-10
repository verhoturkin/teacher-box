import { bearer } from '../support/session';
import { type APIRequestContext, expect, test } from '@playwright/test';

/**
 * Stage 364 (ADR-0057): the teacher connects a provider (the OpenAI-compatible imitation `ai-mock`), adds two
 * models, writes a lesson summary with the default one and then with the other, sees the usage split by model,
 * and removes the connection. The instance has no AI otherwise, so the suite leaves nothing behind.
 */

const TEACHER_PASSWORD = process.env['E2E_TEACHER_PASSWORD'] ?? 'e2e-teacher-pass';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'e2e-admin-pass';
const MOCK_URL = process.env['E2E_AI_URL'] ?? 'http://localhost:8110';
/** How the backend reaches the imitation inside the compose network. */
const MOCK_BASE_URL = process.env['E2E_AI_BASE_URL'] ?? 'http://ai-mock:8098/v1';
const MOCK_KEY = 'mock-key';

interface ModelView {
  readonly id: string;
  readonly modelId: string;
  readonly default: boolean;
}

interface ProviderView {
  readonly id: string;
  readonly name: string;
  readonly keySet: boolean;
  readonly state: string;
  readonly models: ModelView[];
}

interface CheckResult {
  readonly state: string;
  readonly detail: string | null;
  readonly models: { readonly modelId: string; readonly added: boolean }[];
}

interface Settings {
  readonly defaultModelId: string | null;
  readonly monthlyTokenLimit: number;
  readonly version: number;
}

interface Usage {
  readonly models: {
    readonly label: string;
    readonly requests: number;
    readonly removed: boolean;
  }[];
}

test.describe.configure({ mode: 'serial' });

let provider: ProviderView;

async function summary(
  request: APIRequestContext,
  headers: Record<string, string>,
  modelId?: string,
): Promise<{ status: number; text: string }> {
  const response = await request.post('/api/teacher/ai/lesson-summary', {
    headers,
    data: { topic: 'Past Simple', ...(modelId === undefined ? {} : { modelId }) },
  });
  const body = (await response.json()) as { summary?: string };
  return { status: response.status(), text: body.summary ?? '' };
}

test('a wrong key is reported by the check and nothing is saved', async ({ request }) => {
  const headers = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const checked = await request.post('/api/teacher/ai/providers/check', {
    headers,
    data: { kind: 'openai-compatible', apiKey: 'wrong-key', baseUrl: MOCK_BASE_URL },
  });
  expect(checked.ok()).toBe(true);
  expect(((await checked.json()) as CheckResult).state).toBe('FAILED');

  const listed = await request.get('/api/teacher/ai/providers', { headers });
  expect((await listed.json()) as ProviderView[]).toEqual([]);
});

test('the teacher connects the provider and adds two models', async ({ request }) => {
  const headers = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const checked = await request.post('/api/teacher/ai/providers/check', {
    headers,
    data: { kind: 'openai-compatible', apiKey: MOCK_KEY, baseUrl: MOCK_BASE_URL },
  });
  const result = (await checked.json()) as CheckResult;
  expect(result.state).toBe('OK');
  expect(result.models.map((model) => model.modelId)).toEqual(['mock-fast', 'mock-strong']);

  const created = await request.post('/api/teacher/ai/providers', {
    headers,
    data: {
      kind: 'openai-compatible',
      name: 'Imitation',
      apiKey: MOCK_KEY,
      baseUrl: MOCK_BASE_URL,
    },
  });
  expect(created.status()).toBe(201);
  provider = (await created.json()) as ProviderView;
  expect(provider).toMatchObject({ name: 'Imitation', keySet: true, state: 'OK' });
  expect(JSON.stringify(provider)).not.toContain(MOCK_KEY);

  for (const modelId of ['mock-fast', 'mock-strong']) {
    const added = await request.post(`/api/teacher/ai/providers/${provider.id}/models`, {
      headers,
      data: { modelId, label: modelId },
    });
    expect(added.ok(), modelId).toBe(true);
  }
  const listed = (await (
    await request.get('/api/teacher/ai/providers', { headers })
  ).json()) as ProviderView[];
  const models = listed[0]?.models ?? [];
  expect(models.map((model) => [model.modelId, model.default])).toEqual([
    ['mock-fast', true],
    ['mock-strong', false],
  ]);
});

test('the administrator sees the connection without its key', async ({ request }) => {
  const headers = await bearer(request, 'admin', ADMIN_PASSWORD);
  const response = await request.get('/api/admin/ai/providers', { headers });
  expect(response.ok()).toBe(true);
  const text = await response.text();
  expect(text).not.toContain(MOCK_KEY);
  expect(text).not.toContain('Imitation');
  expect(JSON.parse(text)).toHaveLength(1);
});

test('a draft is written by the default model, or by the one the request names', async ({
  request,
}) => {
  const headers = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const byDefault = await summary(request, headers);
  expect(byDefault).toEqual({ status: 200, text: 'Итоги написала модель mock-fast' });

  const listed = (await (
    await request.get('/api/teacher/ai/providers', { headers })
  ).json()) as ProviderView[];
  const other = listed[0]?.models.find((model) => model.modelId === 'mock-strong');
  expect(other).toBeDefined();
  const chosen = await summary(request, headers, other?.id);
  expect(chosen).toEqual({ status: 200, text: 'Итоги написала модель mock-strong' });

  const log = (await (await request.get(`${MOCK_URL}/requests`)).json()) as string[];
  expect(log.slice(-2)).toEqual(['mock-fast', 'mock-strong']);
});

test('an unknown model is a conflict that names the default one', async ({ request }) => {
  const headers = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const response = await request.post('/api/teacher/ai/lesson-summary', {
    headers,
    data: { topic: 'Past Simple', modelId: '00000000-0000-0000-0000-000000000001' },
  });
  expect(response.status()).toBe(409);
  expect(JSON.stringify(await response.json())).toContain('ai.model.unknown');
});

test('the usage is split by model and the settings page lists the connection', async ({
  page,
  request,
}) => {
  const headers = await bearer(page.request, 'teacher', TEACHER_PASSWORD);
  const usage = (await (await request.get('/api/teacher/ai/usage', { headers })).json()) as Usage;
  expect(usage.models.map((model) => [model.label, model.requests])).toEqual([
    ['mock-fast', 1],
    ['mock-strong', 1],
  ]);

  await page.goto('/teacher/settings/ai');
  await expect(page.getByRole('list', { name: 'Imitation' })).toBeVisible();
  await expect(page.getByText('mock-strong').first()).toBeVisible();
});

test('the connection is removed together with its models', async ({ request }) => {
  const headers = await bearer(request, 'teacher', TEACHER_PASSWORD);
  const blocked = await request.delete(`/api/teacher/ai/providers/${provider.id}`, { headers });
  expect(blocked.status()).toBe(409);

  const settings = (await (
    await request.get('/api/teacher/ai/settings', { headers })
  ).json()) as Settings;
  const off = await request.put('/api/teacher/ai/settings', {
    headers,
    data: {
      defaultModelId: null,
      monthlyTokenLimit: settings.monthlyTokenLimit,
      version: settings.version,
    },
  });
  expect(off.ok()).toBe(true);

  const removed = await request.delete(`/api/teacher/ai/providers/${provider.id}`, { headers });
  expect(removed.ok()).toBe(true);
  const listed = await request.get('/api/teacher/ai/providers', { headers });
  expect((await listed.json()) as ProviderView[]).toEqual([]);
});
