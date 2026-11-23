/** Mirrors `HomeworkViews` of the backend. Instants are ISO-8601 strings in UTC. */

import type { PickedTextbook, Video, VideoInput } from '@features/textbooks/parts';

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
  /** The course of the assignment (ADR-0071); `null` — none. */
  readonly courseId: string | null;
  readonly createdAt: string;
  /** The names of its students, alphabetically. */
  readonly students: readonly string[];
  /** The ids of its students: the list filters by student or group. */
  readonly studentIds: readonly string[];
  /** The board it was put on; `null` — none. */
  readonly boardId: string | null;
  readonly totalTasks: number;
  readonly assigned: number;
  readonly submitted: number;
  readonly returned: number;
  readonly accepted: number;
  /** How many materials of each kind it has (the board is `boardId`). */
  readonly textbooks: number;
  readonly files: number;
  readonly questions: number;
  readonly videos: number;
  /** An original of the bank (ADR-0071): content only, never given out. */
  readonly bank: boolean;
  /** The bank item it came from or was saved as; `null` — none. */
  readonly sourceId: string | null;
  /** A bank item: how many working assignments came from it. */
  readonly uses: number;
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
  /** The first 200 characters of the latest answer on one line; `null`: no text. */
  readonly answerPreview: string | null;
  /** Files attached to the latest answer. */
  readonly answerFiles: number;
  /** Points of the best finished quiz attempt and its maximum; `null`: none. */
  readonly quizScore: number | null;
  readonly quizMax: number | null;
}

/** A textbook bound to an assignment (ADR-0033); `pages` — «1-3, 7», `null` — the whole textbook. */
/** A textbook bound to an assignment with its pages (the shape the textbooks feature picks). */
export type BoundTextbook = PickedTextbook;

export type { Video, VideoInput } from '@features/textbooks/parts';

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

/** One question of the best attempt for the teacher; `answer` is `null` when it was left blank. */
export interface ReviewResult {
  readonly question: Question;
  readonly answer: QuizAnswer | null;
  readonly correct: boolean;
  readonly points: number;
  /** The teacher changed the verdict. */
  readonly overridden: boolean;
}

/** The quiz in the task review: the best attempt with the key and the verdicts. */
export interface QuizReview {
  readonly maxPoints: number;
  readonly attemptsUsed: number;
  /** «7 из 10» for the grade field; `null` — no submitted attempt. */
  readonly suggestedGrade: string | null;
  readonly best: QuizAttempt | null;
  readonly results: readonly ReviewResult[];
}

export interface QuestionStats {
  readonly questionId: string;
  readonly text: string;
  /** Students whose best attempt has the question wrong or blank. */
  readonly wrong: number;
}

export interface QuizStats {
  /** Students with a submitted attempt. */
  readonly students: number;
  readonly questions: readonly QuestionStats[];
}

export interface AssignmentDetails {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly dueAt: string | null;
  /** The course of the assignment (ADR-0071); `null` — none. */
  readonly courseId: string | null;
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
  /** Whom a draft is meant for; empty once given out. */
  readonly draftStudentIds: string[];
  /** An original of the bank (ADR-0071): content only, never given out. */
  readonly bank: boolean;
  /** The bank item it came from or was saved as; `null` — none. */
  readonly sourceId: string | null;
  /** A bank item: how many working assignments came from it. */
  readonly uses: number;
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
  /** The quiz with its key; `null`/absent — the assignment has no questions. */
  readonly quiz?: QuizReview | null;
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
  /** Points of the best quiz attempt; `null`: no quiz. */
  readonly quizScore: number | null;
  readonly quizMax: number | null;
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
  /** The teacher's comment of the last review; shown for a returned task. */
  readonly teacherComment: string | null;
  /** The assignment is on a board. */
  readonly board: boolean;
  /** How many materials of each kind the assignment has. */
  readonly textbooks: number;
  readonly files: number;
  readonly questions: number;
  readonly videos: number;
}

export interface AssignmentInput {
  readonly title: string;
  readonly description: string | null;
  readonly dueAt: string | null;
  /** The course (ADR-0071); left out or `null` — none. */
  readonly courseId?: string | null;
  /** The videos in place of the assignment's ones; left out — keep them. */
  readonly videos?: readonly VideoInput[];
  /** The questions in place of the assignment's ones; left out — keep them. */
  readonly questions?: readonly Question[];
  readonly quizReveal?: QuizReveal;
  /** 0 — unlimited. */
  readonly quizAttempts?: number;
  /** A bank item («Материалы» → «Создать»): no students, deadline or board; only on create. */
  readonly bank?: boolean;
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

/** Mirrors `TeacherHomeworkSettingsController.HomeworkSettingsView`. */
export interface HomeworkSettings {
  /** How long before the due date the student is reminded: 60–4320 (1–72 h). */
  readonly dueSoonMinutes: number;
}

/** Mirrors `HomeworkLimitsController.Limits`: what the server takes in an upload. */
export interface HomeworkLimits {
  /** Bytes. */
  readonly maxFileSize: number;
  readonly maxFilesPerUpload: number;
}

/** What a cell of the journal shows. */
export type JournalStatus =
  'ACCEPTED' | 'TO_REVIEW' | 'RETURNED' | 'OVERDUE' | 'WAITING' | 'NOT_ASSIGNED';

/** A column of the journal: an assignment due in the week. */
export interface JournalColumn {
  id: string;
  title: string;
  dueAt: string;
}

/** One student on one assignment; `taskId` is `null` when the assignment is not given to them. */
export interface JournalCell {
  status: JournalStatus;
  taskId: string | null;
  grade: string | null;
  quizScore: number | null;
  quizMax: number | null;
  overdueDays: number | null;
}

export interface JournalRow {
  studentId: string;
  studentName: string;
  studentAvatar: string | null;
  /** One per column, in the order of the columns. */
  cells: JournalCell[];
  handedIn: number;
  given: number;
}

/** Students by the assignments due in a range of dates («По ученикам»). */
export interface Journal {
  assignments: JournalColumn[];
  students: JournalRow[];
}

/** Mirrors `JournalTask` of `homework::api`: one assignment given to the student in the period (ADR-0072). */
export interface PeriodTask {
  readonly taskId: string;
  readonly assignmentId: string;
  readonly title: string;
  readonly assignedAt: string;
  readonly dueAt: string | null;
  readonly status: TaskStatus;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly grade: string | null;
  readonly teacherComment: string | null;
}

/** Mirrors `HomeworkReport`: the homework of a student's period report, oldest first (roadmap 02 stage B). */
export interface TasksReport {
  readonly assigned: number;
  readonly submitted: number;
  readonly onTime: number;
  readonly late: number;
  readonly accepted: number;
  readonly returned: number;
  readonly tasks: readonly PeriodTask[];
}
