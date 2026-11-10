import { locale } from '@core/i18n/language';
import { T } from '../i18n/texts';

/**
 * The examples beside the rules of the first setup (sketch OnbRules): a sample week, read in UTC so that the
 * example does not depend on the device. Thursday 5 November 2026 10:00 is the lesson, Friday 18:00 the
 * homework deadline.
 */
const LESSON = Date.UTC(2026, 10, 5, 10, 0);
const DEADLINE = Date.UTC(2026, 10, 6, 18, 0);
const MINUTE = 60_000;
const HALF_HOUR = 30;

const t = T.setup;
const TIME = new Intl.DateTimeFormat(locale(), {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});
const WEEKDAY = new Intl.DateTimeFormat(locale(), { weekday: 'long', timeZone: 'UTC' });

/** «в среду в 20:00» / «on Wednesday at 20:00». */
function at(time: number): string {
  const date = new Date(time);
  return t.at(t.onDays[date.getUTCDay()] ?? '', TIME.format(date));
}

/**
 * A cancellation that is late: about 60 % of the window before the lesson, in whole half hours (24 h → the
 * evening before at 20:00), a short window halved.
 */
export function lateExample(lateMinutes: number): string {
  if (lateMinutes <= 0) {
    return t.noLate;
  }
  const halfHours = Math.floor((lateMinutes * 0.6) / HALF_HOUR) * HALF_HOUR;
  const before = halfHours > 0 ? halfHours : Math.max(1, Math.round(lateMinutes / 2));
  return t.lateExample(at(LESSON), at(LESSON - before * MINUTE));
}

/** When the student gets each reminder; the teacher only the last one. */
export function remindersExample(reminderMinutes: readonly number[]): string {
  const sorted = [...reminderMinutes].sort((a, b) => b - a);
  const times = sorted.map((minutes) => at(LESSON - minutes * MINUTE));
  const last = times.at(-1);
  const shortest = sorted.at(-1);
  if (last === undefined || shortest === undefined) {
    return t.noRemindersExample;
  }
  if (times.length === 1) {
    return t.oneReminderExample(last);
  }
  const list = `${times.slice(0, -1).join(', ')}${t.and}${last}`;
  return t.remindersExample(list, TIME.format(new Date(LESSON - shortest * MINUTE)));
}

/** The deadline reminder before a Friday deadline. */
export function dueSoonExample(dueSoonMinutes: number): string {
  const deadline = `${WEEKDAY.format(new Date(DEADLINE))}, ${TIME.format(new Date(DEADLINE))}`;
  return t.dueSoonExample(deadline, at(DEADLINE - dueSoonMinutes * MINUTE));
}

/** How far ahead a weekly series is booked. */
export function horizonExample(weeks: number): string {
  return t.horizonExample(weeks);
}
