import { HttpTestingController } from '@angular/common/http/testing';
import {
  LessonsReport,
  PeriodLesson,
  CalendarFeed,
  ChangeRequest,
  LessonRules,
  MyScheduleSummary,
  OffTime,
  ScheduleSettings,
  ScheduleSummary,
  ScheduledLesson,
} from '@features/schedule/data-access/schedule.models';

/** ISO instant of a local date and time (tests do not depend on the machine's time zone). */
export function at(year: number, month: number, day: number, hours: number, minutes = 0): string {
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

export function scheduledLesson(overrides: Partial<ScheduledLesson> = {}): ScheduledLesson {
  return {
    id: 'l-1',
    studentId: 's-1',
    studentName: 'Иван Петров',
    studentAvatar: null,
    groupId: null,
    groupName: null,
    participants: [
      { studentId: 's-1', studentName: 'Иван Петров', studentAvatar: null, attendance: 'EXPECTED' },
    ],
    seriesId: null,
    version: 0,
    repeatWeeks: 0,
    repeatUntil: null,
    repeatVersion: null,
    occurrenceDate: null,
    startsAt: at(2026, 10, 1, 18),
    endsAt: at(2026, 10, 1, 19),
    durationMinutes: 60,
    title: null,
    topic: null,
    meetingUrl: null,
    joinUrl: null,
    status: 'SCHEDULED',
    cancelledBy: null,
    cancelReason: null,
    originalStartsAt: null,
    pendingRequests: [],
    planId: null,
    assignmentIds: [],
    ...overrides,
  };
}

/** A planned lesson of the group «ОГЭ» with two students. */
export function groupLesson(overrides: Partial<ScheduledLesson> = {}): ScheduledLesson {
  return scheduledLesson({
    id: 'gl-1',
    studentId: null,
    studentName: null,
    groupId: 'g-1',
    groupName: 'ОГЭ',
    participants: [
      { studentId: 's-1', studentName: 'Иван Петров', studentAvatar: null, attendance: 'EXPECTED' },
      { studentId: 's-2', studentName: 'Мария', studentAvatar: null, attendance: 'EXCUSED' },
    ],
    durationMinutes: 90,
    ...overrides,
  });
}

export function changeRequest(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'r-1',
    lessonId: 'l-1',
    studentId: 's-1',
    studentName: 'Иван Петров',
    studentAvatar: null,
    groupId: null,
    groupName: null,
    kind: 'RESCHEDULE',
    lessonStartsAt: at(2026, 10, 1, 18),
    proposedStartsAt: at(2026, 10, 2, 17),
    comment: null,
    status: 'PENDING',
    late: false,
    answer: null,
    createdAt: at(2026, 9, 28, 12),
    resolvedAt: null,
    guardianId: null,
    guardianName: null,
    ...overrides,
  };
}

/** Weekly off time: a lunch on Mondays and Wednesdays. */
export function weeklyOffTime(overrides: Partial<OffTime> = {}): OffTime {
  return {
    id: 'off-1',
    kind: 'WEEKLY',
    startsAt: null,
    endsAt: null,
    weekdays: ['MONDAY', 'WEDNESDAY'],
    startTime: '13:00:00',
    endTime: '14:00:00',
    startsOn: '2026-09-01',
    endsOn: null,
    note: 'Обед',
    ...overrides,
  };
}

/** Off time once: a holiday. */
export function onceOffTime(overrides: Partial<OffTime> = {}): OffTime {
  return {
    id: 'off-2',
    kind: 'ONCE',
    startsAt: at(2026, 10, 5, 0),
    endsAt: at(2026, 10, 10, 0),
    weekdays: [],
    startTime: null,
    endTime: null,
    startsOn: null,
    endsOn: null,
    note: null,
    ...overrides,
  };
}

export function scheduleSettings(overrides: Partial<ScheduleSettings> = {}): ScheduleSettings {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    defaultDurationMinutes: 60,
    lateCancellationMinutes: 1440,
    reminderMinutes: [60, 1440],
    workStart: '08:00',
    workEnd: '21:00',
    ...overrides,
  };
}

export function lessonRules(overrides: Partial<LessonRules> = {}): LessonRules {
  return {
    defaultDurationMinutes: 60,
    lateCancellationMinutes: 1440,
    reminderMinutes: [1440, 60],
    horizonWeeks: 12,
    workStart: '08:00',
    workEnd: '21:00',
    ...overrides,
  };
}

export function calendarFeed(overrides: Partial<CalendarFeed> = {}): CalendarFeed {
  return { enabled: false, createdAt: null, path: null, ...overrides };
}

export function scheduleSummary(overrides: Partial<ScheduleSummary> = {}): ScheduleSummary {
  return {
    today: [],
    next: null,
    weekLessons: 0,
    unmarked: 0,
    weekConducted: 0,
    weekMissed: 0,
    pendingRequests: 0,
    hasLessons: true,
    ...overrides,
  };
}

export function myScheduleSummary(overrides: Partial<MyScheduleSummary> = {}): MyScheduleSummary {
  return { next: null, weekLessons: 0, pendingRequests: 0, ...overrides };
}

/**
 * A dialog with a move asks for the free times of a day (and the teacher's one for the lesson's
 * length); the tests that do not care answer none.
 */
export function dropFreeTimes(backend: HttpTestingController): void {
  backend
    .match(
      (request) =>
        request.url.endsWith('/schedule/free-times') ||
        (request.method === 'GET' && /\/teacher\/schedule\/lessons\/[^/]+$/.test(request.url)),
    )
    .filter((r) => !r.cancelled)
    .forEach((r) => {
      r.flush(r.request.url.endsWith('/free-times') ? [] : scheduledLesson());
    });
}

export function periodLesson(overrides: Partial<PeriodLesson> = {}): PeriodLesson {
  return {
    lessonId: 'l-1',
    startsAt: '2026-10-05T15:00:00Z',
    durationMinutes: 60,
    title: null,
    topic: 'Дроби',
    groupId: null,
    outcome: 'ATTENDED',
    cancelledBy: null,
    summary: null,
    nextPlan: null,
    planId: null,
    assignmentIds: [],
    ...overrides,
  };
}

export function lessonsReport(overrides: Partial<LessonsReport> = {}): LessonsReport {
  return {
    held: 1,
    missed: 0,
    excused: 0,
    cancelledByStudent: 0,
    lateCancellations: 0,
    lessons: [periodLesson()],
    ...overrides,
  };
}
