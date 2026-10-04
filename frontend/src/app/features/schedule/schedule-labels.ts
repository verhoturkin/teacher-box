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

/**
 * A status is a role (ADR-0023): `null` — the primary container (the default of `p-tag`: planned),
 * warn — waits for an action.
 */
export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | null;

export const STATUS_LABELS: Readonly<
  Record<ScheduleLessonStatus, { label: string; severity: TagSeverity }>
> = {
  SCHEDULED: { label: 'Запланировано', severity: null },
  CONDUCTED: { label: 'Проведено', severity: 'success' },
  MISSED: { label: 'Пропуск', severity: 'warn' },
  CANCELLED: { label: 'Отменено', severity: 'secondary' },
};

export const KIND_LABELS: Readonly<Record<ChangeKind, string>> = {
  RESCHEDULE: 'Перенос',
  CANCEL: 'Отмена',
};

export const ATTENDANCE_LABELS: Readonly<
  Record<Attendance, { label: string; severity: TagSeverity }>
> = {
  EXPECTED: { label: 'Ожидается', severity: null },
  ATTENDED: { label: 'Был', severity: 'success' },
  MISSED: { label: 'Пропуск', severity: 'warn' },
  EXCUSED: { label: 'Предупредил', severity: 'secondary' },
};

export const REQUEST_STATUS_LABELS: Readonly<
  Record<RequestStatus, { label: string; severity: TagSeverity }>
> = {
  PENDING: { label: 'Ждёт ответа', severity: 'warn' },
  APPROVED: { label: 'Согласовано', severity: 'success' },
  DECLINED: { label: 'Отклонено', severity: 'danger' },
  WITHDRAWN: { label: 'Отозвано', severity: 'secondary' },
  OUTDATED: { label: 'Неактуально', severity: 'secondary' },
};

export interface WeekdayOption {
  readonly value: Weekday;
  readonly short: string;
  readonly label: string;
}

/** Monday to Sunday. */
export const WEEKDAYS: readonly WeekdayOption[] = [
  { value: 'MONDAY', short: 'Пн', label: 'понедельник' },
  { value: 'TUESDAY', short: 'Вт', label: 'вторник' },
  { value: 'WEDNESDAY', short: 'Ср', label: 'среда' },
  { value: 'THURSDAY', short: 'Чт', label: 'четверг' },
  { value: 'FRIDAY', short: 'Пт', label: 'пятница' },
  { value: 'SATURDAY', short: 'Сб', label: 'суббота' },
  { value: 'SUNDAY', short: 'Вс', label: 'воскресенье' },
];

const DAY_TIME = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const TIME = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** «чт, 01.10, 18:00» in the browser's time zone. */
export function formatLessonStart(iso: string): string {
  return DAY_TIME.format(new Date(iso));
}

/** «18:00–19:00» in the browser's time zone. */
export function formatClockRange(startsAt: string, endsAt: string): string {
  return `${TIME.format(new Date(startsAt))}–${TIME.format(new Date(endsAt))}`;
}

/** «чт, 01.10, 18:00–19:00». */
export function formatLessonTime(startsAt: string, endsAt: string): string {
  return `${formatLessonStart(startsAt)}–${TIME.format(new Date(endsAt))}`;
}

/** «Пн, Чт в 18:00» for a series (`HH:mm:ss` local time of the instance). */
export function formatWeekly(weekdays: readonly Weekday[], startTime: string): string {
  const days = WEEKDAYS.filter((day) => weekdays.includes(day.value)).map((day) => day.short);
  return `${days.join(', ')} в ${startTime.slice(0, 5)}`;
}

const DATE = new Intl.DateTimeFormat('ru-RU', {
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
      ? `с ${DATE.format(fromIsoDate(offTime.startsOn))}`
      : '';
  const until = offTime.endsOn === null ? '' : `по ${DATE.format(fromIsoDate(offTime.endsOn))}`;
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
    return `Группа «${lesson.groupName ?? 'без названия'}»`;
  }
  return lesson.studentName ?? 'Ученик';
}

/** What a request asks for; in a group lesson a cancellation means that the student will not come. */
export function requestKindLabel(request: Pick<ChangeRequest, 'groupId' | 'kind'>): string {
  return request.groupId !== null && request.kind === 'CANCEL'
    ? 'Не придёт'
    : KIND_LABELS[request.kind];
}
