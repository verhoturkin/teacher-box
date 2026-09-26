import {
  CalendarFeed,
  ChangeRequest,
  LessonSeries,
  MyScheduleSummary,
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
    seriesId: null,
    startsAt: at(2026, 10, 1, 18),
    endsAt: at(2026, 10, 1, 19),
    durationMinutes: 60,
    topic: null,
    meetingUrl: null,
    status: 'SCHEDULED',
    cancelledBy: null,
    cancelReason: null,
    originalStartsAt: null,
    pendingRequest: null,
    ...overrides,
  };
}

export function changeRequest(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'r-1',
    lessonId: 'l-1',
    studentId: 's-1',
    studentName: 'Иван Петров',
    kind: 'RESCHEDULE',
    lessonStartsAt: at(2026, 10, 1, 18),
    proposedStartsAt: at(2026, 10, 2, 17),
    comment: null,
    status: 'PENDING',
    late: false,
    answer: null,
    createdAt: at(2026, 9, 28, 12),
    resolvedAt: null,
    ...overrides,
  };
}

export function lessonSeries(overrides: Partial<LessonSeries> = {}): LessonSeries {
  return {
    id: 'sr-1',
    studentId: 's-1',
    studentName: 'Иван Петров',
    weekdays: ['TUESDAY', 'THURSDAY'],
    startTime: '18:00:00',
    durationMinutes: 60,
    intervalWeeks: 1,
    startsOn: '2026-10-01',
    endsOn: null,
    topic: null,
    meetingUrl: null,
    ...overrides,
  };
}

export function scheduleSettings(overrides: Partial<ScheduleSettings> = {}): ScheduleSettings {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    defaultDurationMinutes: 60,
    lateCancellationMinutes: 1440,
    reminderMinutes: [60, 1440],
    ...overrides,
  };
}

export function calendarFeed(overrides: Partial<CalendarFeed> = {}): CalendarFeed {
  return { enabled: false, createdAt: null, path: null, ...overrides };
}

export function scheduleSummary(overrides: Partial<ScheduleSummary> = {}): ScheduleSummary {
  return { today: [], weekLessons: 0, unmarked: 0, pendingRequests: 0, hasLessons: true, ...overrides };
}

export function myScheduleSummary(overrides: Partial<MyScheduleSummary> = {}): MyScheduleSummary {
  return { next: null, weekLessons: 0, pendingRequests: 0, ...overrides };
}
