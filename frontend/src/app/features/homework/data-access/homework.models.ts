/** Mirrors `HomeworkViews` of the backend. Instants are ISO-8601 strings in UTC. */

import type { TextbookFormat, TextbookKind } from '@features/textbooks/parts';

export type TaskStatus = 'ASSIGNED' | 'SUBMITTED' | 'RETURNED' | 'ACCEPTED';
export type ReviewDecision = 'ACCEPT' | 'RETURN';
/** Written — text, textbooks, files; on a board; interactive — an HTML page with its own checks (ADR-0040). */
export type AssignmentKind = 'WRITTEN' | 'BOARD' | 'INTERACTIVE';

export interface Attachment {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
  readonly uploadedAt: string;
}

export interface AssignmentSummary {
  readonly id: string;
  readonly kind: AssignmentKind;
  readonly title: string;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly totalTasks: number;
  readonly assigned: number;
  readonly submitted: number;
  readonly returned: number;
  readonly accepted: number;
}

export interface TaskSummary {
  readonly taskId: string;
  readonly studentId: string;
  readonly studentName: string;
  /** Address of the student's photo; `null`: the initials. */
  readonly studentAvatar: string | null;
  readonly status: TaskStatus;
  readonly grade: string | null;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly overdue: boolean;
}

/** A textbook bound to an assignment (ADR-0033); `pages` — «1-3, 7», `null` — the whole textbook. */
export interface BoundTextbook {
  readonly textbookId: string;
  readonly kind: TextbookKind;
  readonly title: string;
  readonly course: string | null;
  readonly format: TextbookFormat;
  readonly pageCount: number | null;
  readonly pages: string | null;
}

export interface AssignmentDetails {
  readonly id: string;
  readonly kind: AssignmentKind;
  readonly title: string;
  readonly description: string | null;
  /** The page of interactive homework; `null` for other kinds. */
  readonly interactiveHtml: string | null;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly version: number;
  readonly attachments: Attachment[];
  readonly tasks: TaskSummary[];
  readonly textbooks: BoundTextbook[];
}

/** One answer as the interactive page judged it; `correct` — `null` when the page does not check it. */
export interface InteractiveAnswer {
  readonly question: string;
  readonly answer: string | null;
  readonly correct: boolean | null;
}

/** What the interactive page reported with «Готово» — a hint for the teacher, not a grade. */
export interface InteractiveResult {
  readonly score: number | null;
  readonly maxScore: number | null;
  readonly answers: readonly InteractiveAnswer[];
}

/** A short-lived link to the page of interactive homework. */
export interface PageLink {
  readonly url: string;
  readonly expiresAt: string;
}

export interface Submission {
  readonly id: string;
  /** `null` for «Готово» of homework on a board or interactive homework. */
  readonly text: string | null;
  readonly result: InteractiveResult | null;
  readonly submittedAt: string;
  readonly attachments: Attachment[];
}

export interface AssignmentInfo {
  readonly id: string;
  readonly kind: AssignmentKind;
  readonly title: string;
  readonly description: string | null;
  readonly dueAt: string | null;
  readonly attachments: Attachment[];
  readonly textbooks: BoundTextbook[];
}

export interface TaskDetails {
  readonly taskId: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly status: TaskStatus;
  readonly grade: string | null;
  readonly teacherComment: string | null;
  readonly assignedAt: string;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly overdue: boolean;
  readonly assignment: AssignmentInfo;
  readonly submissions: Submission[];
}

export interface ReviewQueueItem {
  readonly taskId: string;
  readonly assignmentId: string;
  readonly title: string;
  readonly studentId: string;
  readonly studentName: string;
  /** Address of the student's photo; `null`: the initials. */
  readonly studentAvatar: string | null;
  readonly submittedAt: string | null;
  readonly dueAt: string | null;
}

export interface MyTask {
  readonly taskId: string;
  readonly assignmentId: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly status: TaskStatus;
  readonly grade: string | null;
  readonly overdue: boolean;
  readonly assignedAt: string;
  readonly reviewedAt: string | null;
}

export interface AssignmentInput {
  readonly title: string;
  readonly description: string | null;
  /** The page of interactive homework; ignored for other kinds. */
  readonly interactiveHtml: string | null;
  readonly dueAt: string | null;
}

/** Mirrors `HomeworkSummary`: homework at a glance for the teacher. */
export interface HomeworkSummary {
  readonly toReview: number;
  /** Open tasks of current students past their due date. */
  readonly overdue: number;
  /** Open tasks of current students due within three days. */
  readonly dueSoon: number;
  /** The works waiting longest. */
  readonly oldestToReview: ReviewQueueItem[];
}

/** Mirrors `MyHomeworkSummary`. */
export interface MyHomeworkSummary {
  readonly open: number;
  readonly overdue: number;
  /** Open tasks, the nearest due date first. */
  readonly upcoming: MyTask[];
}
