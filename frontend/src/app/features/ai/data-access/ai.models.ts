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

/** A material of a draft (ADR-0039): pages of a textbook (`pages` `null` — the whole one) or a file of an assignment. */
export type DraftSource =
  | { readonly type: 'TEXTBOOK'; readonly id: string; readonly pages: string | null }
  | { readonly type: 'FILE'; readonly id: string; readonly assignmentId: string };

/**
 * A material the editor offers the assistant: its label and what the backend reads — a saved source named by its
 * IDs, or a picked file not saved yet that goes with the request (ADR-0042).
 */
export interface SourceOption {
  readonly key: string;
  readonly label: string;
  readonly source: DraftSource | File;
}

export interface HomeworkBrief {
  /** The teacher's request in their own words. */
  readonly prompt: string;
  /** What the teacher already called the assignment. */
  readonly title: string | null;
  readonly sources: readonly DraftSource[];
}

export interface HomeworkDraft {
  readonly title: string;
  /** Markdown. */
  readonly description: string;
}

/** Mirrors `PromptView`: a prompt of the teacher's library. */
export interface SavedPrompt {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface PromptInput {
  readonly title: string;
  readonly text: string;
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
  /** The newest requests of the month, the first page of 10. */
  readonly recent: AiRequestLog[];
  /** Whether the month has older requests than `recent`. */
  readonly moreRecent: boolean;
}

/** Mirrors `RequestPage`: the next requests of the log, newest first. */
export interface RequestPage {
  readonly items: AiRequestLog[];
  readonly hasMore: boolean;
}
