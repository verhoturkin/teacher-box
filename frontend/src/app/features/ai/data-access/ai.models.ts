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

/** Mirrors `HomeworkKind` of the backend (the kinds of `homework`). */
export type HomeworkKind = 'WRITTEN' | 'BOARD' | 'INTERACTIVE';

/** The portal's colours (`#rrggbb`) and font that an interactive page follows. */
export interface PageLook {
  readonly font: string;
  readonly primary: string;
  readonly surface: string;
  readonly text: string;
}

export interface HomeworkBrief {
  readonly kind: HomeworkKind;
  /** The teacher's request in their own words. */
  readonly prompt: string;
  /** What the teacher already called the assignment. */
  readonly title: string | null;
  /** `null` — the backend's default look. */
  readonly look: PageLook | null;
}

export interface HomeworkDraft {
  readonly title: string;
  /** Markdown. */
  readonly description: string;
  /** The page of interactive homework; `null` for other kinds. */
  readonly html: string | null;
}

/** Mirrors `PromptView`: a prompt of the teacher's library; `kind` `null` — for any kind. */
export interface SavedPrompt {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly kind: HomeworkKind | null;
  readonly updatedAt: string;
  readonly version: number;
}

export interface PromptInput {
  readonly title: string;
  readonly text: string;
  readonly kind: HomeworkKind | null;
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
