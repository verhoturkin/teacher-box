import type { Page } from '@playwright/test';

const pad = (value: number): string => String(value).padStart(2, '0');

/** `dd.MM.yyyy` of a day relative to today on this machine (the format of the date fields). */
export function dayText(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${String(date.getFullYear())}`;
}

/**
 * Picks a day relative to today in the modal date picker of the date field `#id` (ADR-0067,
 * 430.1): «Выбрать дату», «Следующий месяц» until the day is shown, the day, «ОК». The day is
 * counted in the browser's time zone and found by PrimeNG's `data-date` (`yyyy-M-d`, months from 0).
 */
export async function pickDay(page: Page, id: string, daysFromToday: number): Promise<void> {
  const key = await page.evaluate((days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return `${String(date.getFullYear())}-${String(date.getMonth())}-${String(date.getDate())}`;
  }, daysFromToday);
  await page
    .locator(`tb-date-field:has(#${id})`)
    .getByRole('button', { name: 'Выбрать дату', exact: true })
    .click();
  const picker = page.getByRole('alertdialog', { name: 'Выберите дату' });
  await picker.locator('.tb-date-picker').waitFor();
  // the grid also shows the neighbour months' days, with the same `data-date`
  const day = picker.locator(
    `td:not(.p-datepicker-other-month) > .p-datepicker-day[data-date="${key}"]:not(.p-disabled)`,
  );
  for (let pages = 0; pages < 12 && (await day.count()) === 0; pages++) {
    await picker.getByRole('button', { name: 'Следующий месяц (Page Down)' }).click();
  }
  await day.click();
  await picker.getByRole('button', { name: 'ОК', exact: true }).click();
  await picker.waitFor({ state: 'hidden' });
}

/**
 * Enters a day and a time into a date-with-time row (ADR-0067): the date field `#id` and the time
 * field `#id-time`; each takes the text when it is left. `pick` — the day goes through the modal
 * date picker instead of typing.
 */
export async function enterDateTime(
  page: Page,
  id: string,
  daysFromToday: number,
  hours: number,
  minutes = 0,
  pick = false,
): Promise<void> {
  if (pick) {
    await pickDay(page, id, daysFromToday);
  }
  for (const [selector, text] of [
    ...(pick ? [] : [[`#${id}`, dayText(daysFromToday)] as const]),
    [`#${id}-time`, `${pad(hours)}:${pad(minutes)}`] as const,
  ]) {
    const field = page.locator(selector);
    await field.fill(text);
    await field.blur();
  }
}
