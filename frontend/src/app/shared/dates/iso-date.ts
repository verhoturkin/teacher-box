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
  return new Date(year, month - 1, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}
