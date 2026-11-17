import { locale } from '@core/i18n/language';

/**
 * Typed dates (ADR-0067): day, month and year in that order, split by dots, slashes, dashes or
 * spaces, with a leading 0 or without, the year in 2 digits (20yy) or 4. No masks: the field parses
 * the text on Enter or leaving it. `null` — the text is not a date.
 */
export function parseDate(text: string): Date | null {
  const parts = split(text, 3);
  if (parts === null) {
    return null;
  }
  const [day = 0, month = 0, year = 0] = parts;
  return validDate(year, month, day);
}

/** A typed month («08.2026», «8/26»): the first day of it, or `null`. */
export function parseMonth(text: string): Date | null {
  const parts = split(text, 2);
  if (parts === null) {
    return null;
  }
  const [month = 0, year = 0] = parts;
  return validDate(year, month, 1);
}

/** «17.08.2026» (ru) / «17/08/2026» (en-GB): how a date field shows its value. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** «08.2026» / «08/2026». */
export function formatMonth(date: Date): string {
  return date.toLocaleDateString(locale(), { month: '2-digit', year: 'numeric' });
}

/** «понедельник, 17 августа 2026 г.»: the name of a day for screen readers. */
export function fullDate(date: Date): string {
  return date.toLocaleDateString(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function split(text: string, count: number): number[] | null {
  const parts = text.trim().split(/[./\- ]+/);
  const valid =
    parts.length === count &&
    parts.every((part, index) =>
      index === count - 1 ? /^(\d{2}|\d{4})$/.test(part) : /^\d{1,2}$/.test(part),
    );
  return valid ? parts.map(Number) : null;
}

function validDate(year: number, month: number, day: number): Date | null {
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
