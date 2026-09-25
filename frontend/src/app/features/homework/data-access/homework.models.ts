/** Mirrors `HomeworkViews` of the backend. Instants are ISO-8601 strings in UTC. */

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
  readonly status: TaskStatus;
  readonly grade: string | null;
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly overdue: boolean;
}

export interface AssignmentDetails {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly version: number;
  readonly attachments: Attachment[];
  readonly tasks: TaskSummary[];
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
  readonly attachments: Attachment[];
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
}
