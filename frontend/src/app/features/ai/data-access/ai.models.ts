export type AiFeature = 'HOMEWORK_DRAFT' | 'REVIEW_DRAFT' | 'LESSON_SUMMARY' | 'QUIZ_DRAFT';
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

/**
 * A material of a draft (ADR-0039): pages of a textbook (`pages` `null` — the whole one), a file of an assignment or
 * a video by its transcript (ADR-0047).
 */
export type DraftSource =
  | { readonly type: 'TEXTBOOK'; readonly id: string; readonly pages: string | null }
  | { readonly type: 'FILE'; readonly id: string; readonly assignmentId: string }
  | {
      readonly type: 'VIDEO';
      readonly title: string | null;
      readonly url: string;
      readonly transcript: string;
    };

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
  /** What the AI takes into account about the recipients (their AI tags); the request wins. */
  readonly context?: readonly ContextItem[];
}

/** A tag of the recipients for the AI: «Класс» — «7 · 8» (several values joined). */
export interface ContextItem {
  readonly name: string;
  readonly value: string;
}

export interface HomeworkDraft {
  readonly title: string;
  /** Markdown. */
  readonly description: string;
}

export type DraftedType =
  'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SHORT_TEXT' | 'NUMBER' | 'MATCHING' | 'ORDERING';

/** A question drafted by the AI, valid by the rules of a quiz, in the shape of the editor's question (ids new). */
export interface DraftedQuestion {
  readonly id: string;
  readonly type: DraftedType;
  readonly text: string;
  readonly points: number;
  readonly explanation: string | null;
  readonly options: readonly { readonly id: string; readonly text: string }[];
  /** Ids of the right options. */
  readonly correct: readonly string[];
  readonly accepted: readonly string[];
  readonly value: number | null;
  readonly tolerance: number | null;
  readonly pairs: readonly { readonly id: string; readonly left: string; readonly right: string }[];
}

export interface QuizDraft {
  readonly questions: readonly DraftedQuestion[];
}

/** Mirrors `PromptView`: a prompt of the teacher's library. */
export interface SavedPrompt {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** Mirrors `SystemPromptView`: a system prompt of the assistant (ADR-0043). */
export interface SystemPrompt {
  readonly feature: AiFeature;
  readonly text: string;
  readonly defaultText: string;
  /** Whether the teacher rewrote it; otherwise `text` is the standard one. */
  readonly custom: boolean;
  readonly updatedAt: string | null;
  /** 0 for the standard prompt. */
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
  readonly context?: readonly ContextItem[];
}

/** What the teacher knows about a lesson; at least one of `topic` and `words` is filled. */
export interface LessonSummaryBrief {
  readonly topic: string | null;
  readonly words: string | null;
  /** Titles of the assignments given at the lesson. */
  readonly assignmentTitles: readonly string[];
}

export interface LessonSummaryDraft {
  readonly summary: string;
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

/** Mirrors `ModelUsage`: one model's usage in the month (ADR-0057). */
export interface ModelUsage {
  /** `null` for requests logged before models had ids. */
  readonly modelId: string | null;
  readonly label: string;
  /** The provider kind, e.g. `anthropic`. */
  readonly provider: string;
  /** The model is no longer among the connections. */
  readonly removed: boolean;
  readonly requests: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface UsageReport {
  /** `yyyy-MM`. */
  readonly month: string;
  readonly usedTokens: number;
  readonly monthlyTokenLimit: number;
  readonly features: FeatureUsage[];
  /** The configured models in their order, then the removed ones; only those used in the month. */
  readonly models: ModelUsage[];
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

/** The API a connection speaks (ADR-0057). */
export type ProviderKind = 'anthropic' | 'gemini' | 'openrouter' | 'deepseek' | 'openai-compatible';

/** The state of a connection's last check: `UNCHECKED` since a restart or a change. */
export type ProviderState = 'UNCHECKED' | 'OK' | 'FAILED';

/** Mirrors `ModelView`. */
export interface AiModel {
  readonly id: string;
  readonly modelId: string;
  readonly label: string;
  /** Anthropic effort (`low` … `max`); `null` — the model's default. */
  readonly effort: string | null;
  readonly fallbacks: boolean;
  readonly maxTokens: number;
  readonly timeoutSeconds: number;
  readonly position: number;
  readonly version: number;
  /** The model of a request that names none. */
  readonly default: boolean;
}

/** Mirrors `ProviderView`: a connection; the key is write-only. */
export interface AiProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly name: string;
  readonly keySet: boolean;
  /** The key's last 4 characters; `null` without a key or for a short one. */
  readonly keyEnding: string | null;
  /** The address the teacher gave; `null` — the kind's own. */
  readonly baseUrl: string | null;
  /** The address in use. */
  readonly address: string | null;
  readonly proxy: string | null;
  readonly position: number;
  readonly version: number;
  readonly state: ProviderState;
  /** The provider's answer when the check failed. */
  readonly stateDetail: string | null;
  readonly models: AiModel[];
}

/** A model the provider offers (`added` — already among the connection's models). */
export interface AvailableModel {
  readonly modelId: string;
  readonly label: string;
  readonly added: boolean;
}

/** Mirrors `CheckResult`: the check of a connection not saved yet. */
export interface CheckResult {
  readonly state: ProviderState;
  readonly detail: string | null;
  readonly models: AvailableModel[];
}

/** A new connection; blank `name` — the kind's name. */
export interface ConnectionInput {
  readonly kind: ProviderKind;
  readonly name: string | null;
  readonly apiKey: string | null;
  readonly baseUrl: string | null;
  readonly proxy: string | null;
}

/** A change of a saved connection; blank `apiKey` keeps the key, `removeKey` removes it. */
export interface ConnectionChange {
  readonly name: string;
  readonly apiKey: string | null;
  readonly removeKey: boolean;
  readonly baseUrl: string | null;
  readonly proxy: string | null;
  readonly version: number;
}

/** A model to add or change; blank `label` — from the model id. */
export interface ModelInput {
  readonly modelId: string;
  readonly label: string | null;
  readonly effort: string | null;
  readonly fallbacks: boolean;
  readonly maxTokens: number;
  readonly timeoutSeconds: number;
  /** Required for a change. */
  readonly version?: number;
}

/** Mirrors `SettingsView`: the default model (`null` — the AI is off) and the limit (0 — none). */
export interface AiSettings {
  readonly defaultModelId: string | null;
  readonly monthlyTokenLimit: number;
  readonly version: number;
}
