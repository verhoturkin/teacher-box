import { locale } from '@core/i18n/language';
import { SHARED_T } from '@shared/i18n/texts';
/**
 * Calendar dates (`yyyy-MM-dd`) exchanged with the backend. Conversions use local date parts so
 * that a date picked in the UI never shifts because of the time zone.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toIsoDate(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromIsoDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** `yyyy-MM` of a date. */
export function toIsoMonth(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}`;
}

export function fromIsoMonth(value: string): Date {
  return fromIsoDate(`${value}-01`);
}

/** «2026-09» → «сентябрь 2026»: the month of a report in words (the server sends `YearMonth`). */
export function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  if (year === undefined || month === undefined || Number.isNaN(year) || Number.isNaN(month)) {
    return yearMonth;
  }
  return new Date(year, month - 1, 1).toLocaleDateString(locale(), {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * «сегодня, 10:42», «вчера, 21:03», «31 октября, 16:20»: a moment of the log for people; `capital` starts
 * the line with a capital letter (a title of a row).
 */
export function dayTime(iso: string, capital = false): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  const days = Math.round(
    (new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000,
  );
  const day =
    days === 0
      ? SHARED_T.common.today
      : days === 1
        ? SHARED_T.common.yesterday
        : date.toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
  const text = `${day}, ${time}`;
  return capital ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
