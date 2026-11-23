/* Mirrors `LessonPlanService` views of the backend (ADR-0071, the bank). Instants are ISO-8601 strings in UTC. */

import type { TextbookFormat, TextbookKind } from './textbooks.models';
import type { Video, VideoInput } from './videos.models';

/** A textbook of a plan with its pages. */
export interface PlanTextbook {
  readonly id: string;
  readonly title: string;
  readonly kind: TextbookKind;
  readonly format: TextbookFormat;
  readonly pageCount: number | null;
  /** Normalized pages; `null` — the whole textbook. */
  readonly pages: string | null;
}

/** A lesson plan as the teacher edits it. */
export interface LessonPlan {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly courseId: string | null;
  /** An original of the bank, never on a lesson. */
  readonly bank: boolean;
  /** The bank item it came from or was saved as; `null` — none. */
  readonly sourceId: string | null;
  /** A bank item: how many working plans came from it. */
  readonly uses: number;
  readonly textbooks: readonly PlanTextbook[];
  readonly videos: readonly Video[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

/** A row of the list of plans. */
export interface LessonPlanSummary {
  readonly id: string;
  readonly title: string;
  readonly courseId: string | null;
  readonly bank: boolean;
  readonly sourceId: string | null;
  readonly uses: number;
  readonly updatedAt: string;
  readonly version: number;
}

/** The whole content of a plan, as `POST` and `PUT` take it. */
export interface LessonPlanInput {
  readonly title: string;
  readonly body: string;
  readonly courseId: string | null;
  readonly textbooks: readonly { readonly textbookId: string; readonly pages: string | null }[];
  readonly videos: readonly VideoInput[];
}

/** The answer of «Использовать»: the working copy; the lesson id is only echoed. */
export interface UsedPlan {
  readonly lessonId: string;
  readonly plan: LessonPlan;
}
