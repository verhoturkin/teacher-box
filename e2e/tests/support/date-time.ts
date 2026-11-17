import type { Page } from '@playwright/test';

const pad = (value: number): string => String(value).padStart(2, '0');

/** `dd.MM.yyyy` of a day relative to today on this machine (the format of the date fields). */
export function dayText(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())}`;
}

/**
 * Types a day and a time into a date-with-time row (ADR-0067): the date field `#id` and the time
 * field `#id-time`; each takes the text when it is left.
 */
export async function enterDateTime(
  page: Page,
  id: string,
  daysFromToday: number,
  hours: number,
  minutes = 0,
): Promise<void> {
  for (const [selector, text] of [
    [`#${id}`, dayText(daysFromToday)],
    [`#${id}-time`, `${pad(hours)}:${pad(minutes)}`],
  ] as const) {
    const field = page.locator(selector);
    await field.fill(text);
    await field.blur();
  }
}
