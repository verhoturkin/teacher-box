import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { FileSaver } from '@shared/files/file-saver';
import {
  AssignmentDetails,
  AssignmentSummary,
  HomeworkSummary,
  Attachment,
  BoundTextbook,
  MyHomeworkSummary,
  MyTask,
  ReviewQueueItem,
  Submission,
  TaskDetails,
} from '@features/homework/data-access/homework.models';
import { testProviders } from './setup';

export function boundTextbook(overrides: Partial<BoundTextbook> = {}): BoundTextbook {
  return {
    textbookId: 'tb-1',
    kind: 'TEXTBOOK',
    title: 'Spotlight 5',
    course: 'Английский',
    format: 'PDF',
    pageCount: 120,
    pages: '12-14',
    ...overrides,
  };
}

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
    students: ['Анна', 'Борис'],
    studentIds: ['s-1', 's-2'],
    boardId: null,
    totalTasks: 2,
    assigned: 1,
    submitted: 1,
    returned: 0,
    accepted: 0,
    textbooks: 0,
    files: 0,
    questions: 0,
    videos: 0,
    ...overrides,
  };
}

export function assignmentDetails(overrides: Partial<AssignmentDetails> = {}): AssignmentDetails {
  return {
    id: 'a-1',
    title: 'Дроби',
    description: 'Решить **№1-5**',
    dueAt: '2026-09-10T15:00:00Z',
    boardId: null,
    createdAt: '2026-09-01T10:00:00Z',
    version: 0,
    attachments: [attachment()],
    textbooks: [],
    videos: [],
    questions: [],
    quizReveal: 'AFTER_SUBMIT',
    quizAttempts: 1,
    draftStudentIds: [],
    tasks: [
      {
        taskId: 't-1',
        studentId: 's-1',
        studentName: 'Анна',
        studentAvatar: null,
        status: 'SUBMITTED',
        grade: null,
        submittedAt: '2026-09-05T10:00:00Z',
        reviewedAt: null,
        overdue: false,
        answerPreview: 'Ответ: 12 и 7',
        answerFiles: 1,
        quizScore: 8,
        quizMax: 10,
      },
      {
        taskId: 't-2',
        studentId: 's-2',
        studentName: 'Борис',
        studentAvatar: null,
        status: 'ASSIGNED',
        grade: null,
        submittedAt: null,
        reviewedAt: null,
        overdue: true,
        answerPreview: null,
        answerFiles: 0,
        quizScore: null,
        quizMax: null,
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
      boardId: null,
      attachments: [attachment()],
      textbooks: [],
      videos: [],
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
    studentAvatar: null,
    submittedAt: '2026-09-05T10:00:00Z',
    dueAt: null,
    quizScore: null,
    quizMax: null,
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
    teacherComment: null,
    board: false,
    textbooks: 0,
    files: 0,
    questions: 0,
    videos: 0,
    ...overrides,
  };
}

export function myHomeworkSummary(overrides: Partial<MyHomeworkSummary> = {}): MyHomeworkSummary {
  return { open: 0, overdue: 0, upcoming: [], ...overrides };
}

export function homeworkSummary(overrides: Partial<HomeworkSummary> = {}): HomeworkSummary {
  return {
    toReview: 0,
    overdue: 0,
    dueSoon: 0,
    oldestToReview: [],
    weekAssigned: 0,
    weekOnTime: 0,
    ...overrides,
  };
}

/** The students of the teacher's homework pages: the deactivated one is never offered. */
export const HOMEWORK_STUDENTS = [
  { id: 's-1', displayName: 'Анна', status: 'ACTIVE' },
  { id: 's-2', displayName: 'Борис', status: 'ACTIVE' },
  { id: 's-3', displayName: 'Вера', status: 'INVITED' },
  { id: 's-4', displayName: 'Гена', status: 'DEACTIVATED' },
].map((student) => ({
  ...student,
  avatar: null,
  email: null,
  phone: null,
  note: null,
  login: null,
  createdAt: '2026-09-01T10:00:00Z',
  version: 0,
  pendingInvite: null,
}));

export const REVIEW_QUEUE_URL = '/api/teacher/homework/review-queue';
export const ASSIGNMENTS_URL = '/api/teacher/homework/assignments';

/** The test module of a teacher's homework page: the backend and the names of the files it saved. */
export function configureHomework(): { backend: HttpTestingController; saved: string[] } {
  TestBed.configureTestingModule({
    providers: testProviders(),
  });
  const saved: string[] = [];
  vi.spyOn(TestBed.inject(FileSaver), 'save').mockImplementation((_blob, filename) => {
    saved.push(filename);
  });
  vi.spyOn(TestBed.inject(MessageService), 'add');
  return { backend: TestBed.inject(HttpTestingController), saved };
}
