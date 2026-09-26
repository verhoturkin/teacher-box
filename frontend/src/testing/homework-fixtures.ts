import {
  AssignmentDetails,
  AssignmentSummary,
  Attachment,
  HomeworkSummary,
  MyHomeworkSummary,
  MyTask,
  ReviewQueueItem,
  Submission,
  TaskDetails,
} from '@features/homework/data-access/homework.models';

export function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'f-1',
    filename: 'условие.pdf',
    contentType: 'application/pdf',
    size: 2_560,
    uploadedAt: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

export function assignmentSummary(overrides: Partial<AssignmentSummary> = {}): AssignmentSummary {
  return {
    id: 'a-1',
    title: 'Дроби',
    dueAt: '2026-09-10T15:00:00Z',
    createdAt: '2026-09-01T10:00:00Z',
    totalTasks: 2,
    assigned: 1,
    submitted: 1,
    returned: 0,
    accepted: 0,
    ...overrides,
  };
}

export function assignmentDetails(overrides: Partial<AssignmentDetails> = {}): AssignmentDetails {
  return {
    id: 'a-1',
    title: 'Дроби',
    description: 'Решить **№1-5**',
    dueAt: '2026-09-10T15:00:00Z',
    createdAt: '2026-09-01T10:00:00Z',
    version: 0,
    attachments: [attachment()],
    tasks: [
      {
        taskId: 't-1',
        studentId: 's-1',
        studentName: 'Анна',
        status: 'SUBMITTED',
        grade: null,
        submittedAt: '2026-09-05T10:00:00Z',
        reviewedAt: null,
        overdue: false,
      },
      {
        taskId: 't-2',
        studentId: 's-2',
        studentName: 'Борис',
        status: 'ASSIGNED',
        grade: null,
        submittedAt: null,
        reviewedAt: null,
        overdue: true,
      },
    ],
    ...overrides,
  };
}

export function submission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: 'sub-1',
    text: 'Мой ответ',
    submittedAt: '2026-09-05T10:00:00Z',
    attachments: [attachment({ id: 'f-2', filename: 'решение.jpg', contentType: 'image/jpeg' })],
    ...overrides,
  };
}

export function taskDetails(overrides: Partial<TaskDetails> = {}): TaskDetails {
  return {
    taskId: 't-1',
    studentId: 's-1',
    studentName: 'Анна',
    status: 'SUBMITTED',
    grade: null,
    teacherComment: null,
    assignedAt: '2026-09-01T10:00:00Z',
    submittedAt: '2026-09-05T10:00:00Z',
    reviewedAt: null,
    overdue: false,
    assignment: {
      id: 'a-1',
      title: 'Дроби',
      description: 'Решить **№1-5**',
      dueAt: '2026-09-10T15:00:00Z',
      attachments: [attachment()],
    },
    submissions: [submission()],
    ...overrides,
  };
}

export function reviewQueueItem(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    taskId: 't-1',
    assignmentId: 'a-1',
    title: 'Дроби',
    studentId: 's-1',
    studentName: 'Анна',
    submittedAt: '2026-09-05T10:00:00Z',
    dueAt: null,
    ...overrides,
  };
}

export function myTask(overrides: Partial<MyTask> = {}): MyTask {
  return {
    taskId: 't-1',
    assignmentId: 'a-1',
    title: 'Дроби',
    dueAt: '2026-09-10T15:00:00Z',
    status: 'ASSIGNED',
    grade: null,
    overdue: false,
    assignedAt: '2026-09-01T10:00:00Z',
    reviewedAt: null,
    ...overrides,
  };
}

export function homeworkSummary(overrides: Partial<HomeworkSummary> = {}): HomeworkSummary {
  return { toReview: 0, overdue: 0, dueSoon: 0, oldestToReview: [], ...overrides };
}

export function myHomeworkSummary(overrides: Partial<MyHomeworkSummary> = {}): MyHomeworkSummary {
  return { open: 0, overdue: 0, upcoming: [], ...overrides };
}
