import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import {
  Attendance,
  ChangeKind,
  ChangeRequest,
  OffTime,
  RequestStatus,
  ScheduleLessonStatus,
  ScheduledLesson,
  Weekday,
} from './data-access/schedule.models';
import { T } from './i18n/texts';
import { locale } from '@core/i18n/language';

/**
 * A status is a role (ADR-0023): `null` — the primary container (the default of `p-tag`: planned),
 * warn — waits for an action.
 */
export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | null;

export const STATUS_LABELS: Readonly<
  Record<ScheduleLessonStatus, { label: string; severity: TagSeverity }>
> = {
  SCHEDULED: { label: T.statuses.SCHEDULED, severity: null },
  CONDUCTED: { label: T.statuses.CONDUCTED, severity: 'success' },
  MISSED: { label: T.statuses.MISSED, severity: 'warn' },
  CANCELLED: { label: T.statuses.CANCELLED, severity: 'secondary' },
};

export const KIND_LABELS: Readonly<Record<ChangeKind, string>> = T.kinds;

export const ATTENDANCE_LABELS: Readonly<
  Record<Attendance, { label: string; severity: TagSeverity }>
> = {
  EXPECTED: { label: T.attendance.EXPECTED, severity: null },
  ATTENDED: { label: T.attendance.ATTENDED, severity: 'success' },
  MISSED: { label: T.attendance.MISSED, severity: 'warn' },
  EXCUSED: { label: T.attendance.EXCUSED, severity: 'secondary' },
};

export const REQUEST_STATUS_LABELS: Readonly<
  Record<RequestStatus, { label: string; severity: TagSeverity }>
> = {
  PENDING: { label: T.requestStatuses.PENDING, severity: 'warn' },
  APPROVED: { label: T.requestStatuses.APPROVED, severity: 'success' },
  DECLINED: { label: T.requestStatuses.DECLINED, severity: 'danger' },
  WITHDRAWN: { label: T.requestStatuses.WITHDRAWN, severity: 'secondary' },
  OUTDATED: { label: T.requestStatuses.OUTDATED, severity: 'secondary' },
};

export interface WeekdayOption {
  readonly value: Weekday;
  readonly short: string;
  readonly label: string;
}

/** Monday to Sunday. */
export const WEEKDAYS: readonly WeekdayOption[] = (
  ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const
).map((value, index) => ({
  value,
  short: T.weekdaysShort[index] ?? value,
  label: T.weekdays[index] ?? value,
}));

const DAY_TIME = new Intl.DateTimeFormat(locale(), {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const TIME = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });

/** «чт, 01.10, 18:00» in the browser's time zone. */
export function formatLessonStart(iso: string): string {
  return DAY_TIME.format(new Date(iso));
}

/** «чт, 01.10, 18:00–19:00». */
export function formatLessonTime(startsAt: string, endsAt: string): string {
  return `${formatLessonStart(startsAt)}–${TIME.format(new Date(endsAt))}`;
}

/** «Пн, Чт в 18:00» for a series (`HH:mm:ss` local time of the instance). */
export function formatWeekly(weekdays: readonly Weekday[], startTime: string): string {
  const days = WEEKDAYS.filter((day) => weekdays.includes(day.value)).map((day) => day.short);
  return T.weekly(days.join(', '), startTime.slice(0, 5));
}

const DATE = new Intl.DateTimeFormat(locale(), {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * When the teacher does not work: «пн, 05.10, 13:00–14:00», «пн, 05.10, 00:00 – пт, 09.10, 00:00»
 * or «Пн, Ср 13:00–14:00, с 05.10.2026 по 30.10.2026».
 */
export function formatOffTime(offTime: OffTime): string {
  if (offTime.kind === 'ONCE') {
    const start = offTime.startsAt ?? '';
    const end = offTime.endsAt ?? '';
    return new Date(start).toDateString() === new Date(end).toDateString()
      ? formatLessonTime(start, end)
      : `${formatLessonStart(start)} – ${formatLessonStart(end)}`;
  }
  const days = WEEKDAYS.filter((day) => offTime.weekdays.includes(day.value)).map(
    (day) => day.short,
  );
  const time = `${(offTime.startTime ?? '').slice(0, 5)}–${(offTime.endTime ?? '').slice(0, 5)}`;
  const since =
    offTime.startsOn !== null && fromIsoDate(offTime.startsOn) > new Date()
      ? T.since(DATE.format(fromIsoDate(offTime.startsOn)))
      : '';
  const until = offTime.endsOn === null ? '' : T.until(DATE.format(fromIsoDate(offTime.endsOn)));
  const dates = [since, until].filter((part) => part !== '').join(' ');
  return `${days.join(', ')} ${time}${dates === '' ? '' : `, ${dates}`}`;
}

/** Time zone of the browser, e.g. `Europe/Moscow`. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Trimmed text of an optional field, `null` when empty. */
export function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The calendar's days with one more day on each side: the backend counts days in the portal's
 * time zone, which may differ from the browser's.
 */
export function widen(range: { readonly from: string; readonly to: string }): {
  from: string;
  to: string;
} {
  const from = fromIsoDate(range.from);
  const to = fromIsoDate(range.to);
  from.setDate(from.getDate() - 1);
  to.setDate(to.getDate() + 1);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/** Who the lesson is with: «Группа «ОГЭ»» or the student's name. */
export function lessonWith(
  lesson: Pick<ScheduledLesson, 'groupId' | 'groupName' | 'studentName'>,
): string {
  if (lesson.groupId !== null) {
    return T.group(lesson.groupName ?? T.noTitle);
  }
  return lesson.studentName ?? T.student;
}

/** What a request asks for; in a group lesson a cancellation means that the student will not come. */
export function requestKindLabel(request: Pick<ChangeRequest, 'groupId' | 'kind'>): string {
  return request.groupId !== null && request.kind === 'CANCEL'
    ? T.wontCome
    : KIND_LABELS[request.kind];
}

/** Whether the student said they would not come to this group lesson. */
export function excusedFrom(lesson: ScheduledLesson): boolean {
  return lesson.participants.some((participant) => participant.attendance === 'EXCUSED');
}
