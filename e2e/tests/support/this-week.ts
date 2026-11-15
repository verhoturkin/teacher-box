import { type Page, expect, test } from '@playwright/test';

/** The browser's time zone in the tests (playwright.config.ts). */
const ZONE = 'Europe/Moscow';
const DAY_MS = 86_400_000;

/** A lesson of {@link laterThisWeek}: `days` from this machine's date, the time in Moscow. */
export interface WeekLesson {
  days: number;
  hours: number;
  minutes: number;
  /** The same start as an instant. */
  startsAt: string;
}

/** How long before its start a Sunday lesson is planned: the scenario must ask about it first. */
const LEAD_MINUTES = 10;
/** The latest start of a Sunday lesson, in minutes after midnight. */
const LAST_START = 23 * 60 + 55;

/**
 * A day and a time for a lesson the student sees in «Ближайшие занятия» — the lessons of the
 * current week (Monday first) in the browser's time zone, not started yet (a started lesson cannot
 * be moved). It is the next day at `hours`, or the last hour of today when today is Sunday there,
 * at least {@link LEAD_MINUTES} ahead; in the last quarter of an hour of a Sunday it waits for
 * Monday. `days` counts from today on this machine, as the date pickers are filled from this
 * machine's date.
 */
export async function laterThisWeek(hours: number): Promise<WeekLesson> {
  if (isSunday(thereNow()) && minutesOf(thereNow()) + LEAD_MINUTES > LAST_START) {
    const wait = (DAY_MS / 60_000 - minutesOf(thereNow())) * 60_000 + 5_000;
    test.setTimeout(test.info().timeout + wait);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  const now = new Date();
  const there = thereNow();
  const shift = daysToTodayThere();
  let lesson = { days: shift + 1, hours, minutes: 0 };
  if (isSunday(there)) {
    const start = Math.max(23 * 60, Math.ceil((minutesOf(there) + LEAD_MINUTES) / 5) * 5);
    lesson = { days: shift, hours: Math.floor(start / 60), minutes: start % 60 };
  }
  const day = new Date(now.getTime() + lesson.days * DAY_MS).toLocaleDateString('sv-SE');
  const time = `${String(lesson.hours).padStart(2, '0')}:${String(lesson.minutes).padStart(2, '0')}`;
  return { ...lesson, startsAt: new Date(`${day}T${time}:00+03:00`).toISOString() };
}

/**
 * Days from this machine's date to today in the browser's time zone, for the date pickers, which
 * are filled from this machine's date: 1 from 21:00 UTC on a machine in UTC, when it is already
 * tomorrow in Moscow (the week shown is then the next one on a Sunday).
 */
export function daysToTodayThere(): number {
  return Math.round((midnight(thereNow()) - midnight(new Date())) / DAY_MS);
}

/** Now as a wall clock in the browser's time zone (a local `Date` showing Moscow's time). */
function thereNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: ZONE }));
}

function isSunday(there: Date): boolean {
  return there.getDay() === 0;
}

function minutesOf(there: Date): number {
  return there.getHours() * 60 + there.getMinutes();
}

/**
 * Today at `hour`:00 in the browser's time zone (Moscow, UTC+3 all year): the week view opens on that day even
 * when this machine's date is already another one (after 21:00 in Moscow on a machine east of it).
 */
export function todayThereAt(hour: number): string {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: ZONE });
  return new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+03:00`).toISOString();
}

/** The calendar day of `date` in the browser's time zone, `2026-11-11`. */
function dayThere(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: ZONE });
}

/**
 * A phone's agenda opens on today. A lesson that started a few hours ago is on yesterday there
 * during the first hours of the day: the day strip (Monday first) then goes to the lesson's day,
 * through the previous week when that day is a Sunday.
 */
export async function openAgendaDayOf(page: Page, startsAt: Date): Promise<void> {
  const day = dayThere(startsAt);
  if (day === dayThere(new Date())) {
    return;
  }
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (weekday === 0) {
    await page.getByRole('button', { name: 'Предыдущая неделя' }).click();
  }
  const chip = page.locator('.tb-agenda__day').nth((weekday + 6) % 7);
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
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
