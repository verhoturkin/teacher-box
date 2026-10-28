/** Mirrors `HomeworkViews` of the backend. Instants are ISO-8601 strings in UTC. */

import type { TextbookFormat, TextbookKind } from '@features/textbooks/parts';

export type TaskStatus = 'ASSIGNED' | 'SUBMITTED' | 'RETURNED' | 'ACCEPTED';
export type ReviewDecision = 'ACCEPT' | 'RETURN';

export interface Attachment {
  readonly id: string;
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
  readonly uploadedAt: string;
}

export interface AssignmentSummary {
  readonly id: string;
  readonly title: string;
  readonly dueAt: string | null;
  readonly createdAt: string;
  /** The names of its students, alphabetically. */
  readonly students: readonly string[];
  /** The board it was put on; `null` — none. */
  readonly boardId: string | null;
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

export type VideoProvider = 'YOUTUBE' | 'RUTUBE' | 'VK' | 'OTHER';

/** A video of an assignment by link (ADR-0047). */
export interface Video {
  readonly url: string;
  readonly provider: VideoProvider;
  /** The video on its platform; `null` — a plain link opened in a new tab. */
  readonly videoId: string | null;
  /** Where the player starts; `null` — from the beginning. */
  readonly startSeconds: number | null;
  readonly title: string | null;
  /** Lines «[m:ss] text»; `null` — none, or hidden from the student. */
  readonly transcript: string | null;
  /** The student sees the transcript. */
  readonly transcriptShown: boolean;
}

/** A video the teacher gives with the assignment. */
export interface VideoInput {
  readonly url: string;
  readonly title: string | null;
  readonly transcript: string | null;
  readonly transcriptShown: boolean;
}

/** A caption track of a YouTube video. */
export interface CaptionTrack {
  /** The code of the track: `en`, `ru`… */
  readonly language: string;
  /** Recognized by YouTube, not written by the author. */
  readonly automatic: boolean;
}

/** «Взять субтитры с YouTube»: the caption tracks of a video to choose from. */
export interface CaptionTracks {
  readonly title: string | null;
  /** In YouTube's order, never empty. */
  readonly tracks: readonly CaptionTrack[];
  /** Taken when the teacher does not choose: the author's in the spoken language, else the recognized one. */
  readonly suggested: CaptionTrack;
}

/** «Взять субтитры с YouTube»: the captions as a transcript. */
export interface VideoTranscript {
  readonly title: string | null;
  /** The code of the caption track: `en`, `ru`… */
  readonly language: string;
  /** Recognized by YouTube, not written by the author. */
  readonly automatic: boolean;
  readonly transcript: string;
  /** The end did not fit and is cut off. */
  readonly truncated: boolean;
}

export type QuestionType =
  'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'SHORT_TEXT' | 'NUMBER' | 'MATCHING' | 'ORDERING';

/** When the student sees the correct answers of a quiz. */
export type QuizReveal = 'AFTER_SUBMIT' | 'AFTER_DUE' | 'NEVER';

/** A choice of a question, or an item of an ordering (in the right order). */
export interface QuestionOption {
  readonly id: string;
  readonly text: string;
}

/** A pair of a matching question. */
export interface QuestionPair {
  readonly id: string;
  readonly left: string;
  readonly right: string;
}

/** A question as the teacher sees it, with the key (ADR-0052); the fields of other types are empty. */
export interface Question {
  readonly id: string;
  readonly type: QuestionType;
  readonly text: string;
  readonly points: number;
  readonly explanation: string | null;
  readonly options: readonly QuestionOption[];
  /** Ids of the right options. */
  readonly correct: readonly string[];
  readonly accepted: readonly string[];
  readonly value: number | null;
  readonly tolerance: number | null;
  readonly pairs: readonly QuestionPair[];
}

/** An option, an ordering item or one side of a matching pair as the student sees it (no key). */
export interface QuizItem {
  readonly id: string;
  readonly text: string;
}

/** A question without the key; options, items and the right column are shuffled by the server. */
export interface QuizQuestion {
  readonly id: string;
  readonly type: QuestionType;
  readonly text: string;
  readonly points: number;
  readonly options: readonly QuizItem[];
  readonly left: readonly QuizItem[];
  readonly right: readonly QuizItem[];
}

/** The student's answer; the field used depends on the question type. */
export interface QuizAnswer {
  readonly ids?: readonly string[] | null;
  readonly text?: string | null;
  readonly number?: number | null;
  /** Left pair id → right pair id. */
  readonly pairs?: Readonly<Record<string, string>> | null;
}

export interface QuizAttempt {
  readonly id: string;
  readonly startedAt: string;
  readonly submittedAt: string | null;
  readonly scorePoints: number | null;
  readonly maxPoints: number | null;
}

export interface QuizOpenAttempt {
  readonly id: string;
  readonly startedAt: string;
  readonly answers: Readonly<Record<string, QuizAnswer>>;
}

/** A question of the best attempt with the key; only after the reveal rule allows it. */
export interface QuizResult {
  readonly question: Question;
  readonly answer: QuizAnswer | null;
  readonly correct: boolean;
  readonly points: number;
}

/** The quiz of a task for the student. */
export interface QuizView {
  readonly questions: readonly QuizQuestion[];
  readonly maxPoints: number;
  readonly reveal: QuizReveal;
  /** `null` — unlimited. */
  readonly attemptsAllowed: number | null;
  readonly attemptsUsed: number;
  readonly attemptsLeft: number | null;
  readonly canStart: boolean;
  readonly openAttempt: QuizOpenAttempt | null;
  readonly attempts: readonly QuizAttempt[];
  readonly best: QuizAttempt | null;
  readonly results: readonly QuizResult[] | null;
}

export interface AssignmentDetails {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly dueAt: string | null;
  /** The board the assignment was put on; `null` — none. */
  readonly boardId: string | null;
  readonly createdAt: string;
  readonly version: number;
  readonly attachments: Attachment[];
  readonly tasks: TaskSummary[];
  readonly textbooks: BoundTextbook[];
  readonly videos: Video[];
  readonly questions: Question[];
  readonly quizReveal: QuizReveal;
  /** `null` — unlimited. */
  readonly quizAttempts: number | null;
}

export interface Submission {
  readonly id: string;
  readonly text: string | null;
  readonly submittedAt: string;
  readonly attachments: Attachment[];
}

export interface AssignmentInfo {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly dueAt: string | null;
  /** The board the assignment was put on; `null` — none. */
  readonly boardId: string | null;
  readonly attachments: Attachment[];
  readonly textbooks: BoundTextbook[];
  readonly videos: Video[];
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
  readonly dueAt: string | null;
  /** The videos in place of the assignment's ones; left out — keep them. */
  readonly videos?: readonly VideoInput[];
  /** The questions in place of the assignment's ones; left out — keep them. */
  readonly questions?: readonly Question[];
  readonly quizReveal?: QuizReveal;
  /** 0 — unlimited. */
  readonly quizAttempts?: number;
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
  /** Assignments given to current students in the current calendar week (Monday to Sunday). */
  readonly weekAssigned: number;
  /** Works of current students handed in this week not later than the due date. */
  readonly weekOnTime: number;
}

/** Mirrors `MyHomeworkSummary`. */
export interface MyHomeworkSummary {
  readonly open: number;
  readonly overdue: number;
  /** Open tasks, the nearest due date first. */
  readonly upcoming: MyTask[];
}

/** Mirrors `HomeworkLimitsController.Limits`: what the server takes in an upload. */
export interface HomeworkLimits {
  /** Bytes. */
  readonly maxFileSize: number;
  readonly maxFilesPerUpload: number;
}
