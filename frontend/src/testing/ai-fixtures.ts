import { AiStatus, UsageReport } from '@features/ai/data-access/ai.models';

export function aiStatus(overrides: Partial<AiStatus> = {}): AiStatus {
  return {
    enabled: true,
    provider: 'anthropic',
    model: 'claude-opus-5',
    usedThisMonth: 1_500,
    monthlyTokenLimit: 2_000_000,
    limitReached: false,
    ...overrides,
  };
}

export function usageReport(overrides: Partial<UsageReport> = {}): UsageReport {
  return {
    month: '2026-09',
    usedTokens: 500_000,
    monthlyTokenLimit: 2_000_000,
    features: [
      { feature: 'HOMEWORK_DRAFT', requests: 3, inputTokens: 1_000, outputTokens: 2_000 },
      { feature: 'REVIEW_DRAFT', requests: 1, inputTokens: 400, outputTokens: 100 },
    ],
    recent: [
      {
        feature: 'HOMEWORK_DRAFT',
        model: 'claude-opus-5',
        status: 'SUCCEEDED',
        inputTokens: 300,
        outputTokens: 700,
        durationMs: 12_500,
        error: null,
        createdAt: '2026-09-24T10:00:00Z',
      },
      {
        feature: 'REVIEW_DRAFT',
        model: 'claude-opus-5',
        status: 'FAILED',
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 800,
        error: 'Anthropic API 529: Overloaded',
        createdAt: '2026-09-24T09:00:00Z',
      },
    ],
    ...overrides,
  };
}
