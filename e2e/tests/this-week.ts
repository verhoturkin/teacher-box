import { type Page, expect } from '@playwright/test';

/** The browser's time zone in the tests (playwright.config.ts). */
const ZONE = 'Europe/Moscow';
const DAY_MS = 86_400_000;

/**
 * A day and an hour for a lesson the student sees in «Ближайшие занятия» — the lessons of the
 * current week (Monday first) in the browser's time zone. It is the next day, or the last hour of
 * today when today is Sunday there. `days` counts from today on this machine, as the date pickers
 * are filled from this machine's date.
 */
export function laterThisWeek(hours: number): { days: number; hours: number } {
  const now = new Date();
  const there = new Date(now.toLocaleString('en-US', { timeZone: ZONE }));
  const shift = Math.round((midnight(there) - midnight(now)) / DAY_MS);
  return there.getDay() === 0 ? { days: shift, hours: 23 } : { days: shift + 1, hours };
}

function midnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Saves the lesson dialog. On Sundays the lessons of this week share the last hour, so a lesson of
 * another scenario may take the time: the teacher then saves anyway.
 */
export async function saveLesson(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Сохранить' }).click();
  const anyway = page.getByRole('button', { name: 'Всё равно сохранить' });
  const dialog = page.getByRole('dialog');
  await expect(async () => {
    if (await anyway.isVisible()) {
      await anyway.click();
    }
    await expect(dialog).toBeHidden({ timeout: 1000 });
  }).toPass();
}
