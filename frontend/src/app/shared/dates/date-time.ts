import { toIsoDate } from './iso-date';
import { toHhMm } from './typed-time';

/**
 * A date with a time as two fields (ADR-0067): the day (`Date` at midnight) and the wall time
 * (`HH:mm`) join into one moment and split back in the zone the screen works in.
 */
export function joinDateTime(day: Date, time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

/** The day of a moment, at midnight. */
export function dayOf(moment: Date): Date {
  return new Date(moment.getFullYear(), moment.getMonth(), moment.getDate());
}

/** The wall time `HH:mm` of a moment. */
export function timeOf(moment: Date): string {
  return toHhMm(moment.getHours(), moment.getMinutes());
}

/**
 * The earliest time allowed on `day` when nothing before `min` is: `min` rounded up to `step`
 * minutes on the day of `min`, `null` on other days. «24:00» — no time is left that day (it sorts
 * after every `HH:mm`).
 */
export function earliestTime(day: Date, min: Date | null, step: number): string | null {
  if (min === null || toIsoDate(day) !== toIsoDate(min)) {
    return null;
  }
  const minutes = (min.getTime() - dayOf(min).getTime()) / 60_000;
  const rounded = Math.ceil(minutes / step) * step;
  return toHhMm(Math.floor(rounded / 60), rounded % 60);
}
