import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import { ChangeKind, RequestStatus, ScheduleLessonStatus, Weekday } from './data-access/schedule.models';

export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

export const STATUS_LABELS: Readonly<Record<ScheduleLessonStatus, { label: string; severity: TagSeverity }>> = {
  SCHEDULED: { label: 'Запланировано', severity: 'info' },
  CONDUCTED: { label: 'Проведено', severity: 'success' },
  MISSED: { label: 'Пропуск', severity: 'warn' },
  CANCELLED: { label: 'Отменено', severity: 'secondary' },
};

export const KIND_LABELS: Readonly<Record<ChangeKind, string>> = {
  RESCHEDULE: 'Перенос',
  CANCEL: 'Отмена',
};

export const REQUEST_STATUS_LABELS: Readonly<Record<RequestStatus, { label: string; severity: TagSeverity }>> = {
  PENDING: { label: 'Ждёт ответа', severity: 'info' },
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
export function widen(range: { readonly from: string; readonly to: string }): { from: string; to: string } {
  const from = fromIsoDate(range.from);
  const to = fromIsoDate(range.to);
  from.setDate(from.getDate() - 1);
  to.setDate(to.getDate() + 1);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}
