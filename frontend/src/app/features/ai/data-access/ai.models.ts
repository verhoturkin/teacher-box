export type AiFeature = 'HOMEWORK_DRAFT' | 'REVIEW_DRAFT';
export type AiRequestStatus = 'SUCCEEDED' | 'FAILED' | 'REFUSED';

/** Mirrors `AiStatus` of the backend. */
export interface AiStatus {
  readonly enabled: boolean;
  readonly provider: string | null;
  readonly model: string | null;
  readonly usedThisMonth: number;
  /** 0 means no limit. */
  readonly monthlyTokenLimit: number;
  readonly limitReached: boolean;
}

export interface HomeworkBrief {
  readonly topic: string;
  readonly level: string | null;
  readonly taskCount: number;
  readonly wishes: string | null;
}

export interface HomeworkDraft {
  readonly title: string;
  /** Markdown. */
  readonly description: string;
}

export interface ReviewBrief {
  readonly title: string;
  readonly description: string | null;
  readonly answer: string;
}

export interface ReviewDraft {
  readonly comment: string;
  readonly grade: string | null;
  /** Suggestion: accept the work (`true`) or return it for revision. */
  readonly accept: boolean;
}

export interface FeatureUsage {
  readonly feature: AiFeature;
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AiRequestLog {
  readonly feature: AiFeature;
  readonly model: string;
  readonly status: AiRequestStatus;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly durationMs: number;
  readonly error: string | null;
  readonly createdAt: string;
}

export interface UsageReport {
  /** `yyyy-MM`. */
  readonly month: string;
  readonly usedTokens: number;
  readonly monthlyTokenLimit: number;
  readonly features: FeatureUsage[];
  readonly recent: AiRequestLog[];
}
