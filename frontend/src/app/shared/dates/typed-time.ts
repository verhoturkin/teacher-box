/**
 * Typed times (ADR-0067), 24-hour: «14:30», «14.30», «14 30», «1430», «930», «9» → `HH:mm`. Hours
 * alone are on the hour; minutes, when typed, are two digits. No masks: the field parses the text on
 * Enter or leaving it. `null` — the text is not a time.
 */
export function parseTime(text: string): string | null {
  const trimmed = text.trim();
  const split = /^(\d{1,2})[:. ](\d{2})$/.exec(trimmed);
  const joined = /^\d{1,4}$/.test(trimmed) ? trimmed : null;
  let hours: number;
  let minutes: number;
  if (split !== null) {
    hours = Number(split[1]);
    minutes = Number(split[2]);
  } else if (joined !== null) {
    // «9», «14» — hours; «930», «1430» — the last two digits are the minutes
    const hourDigits = joined.length <= 2 ? joined.length : joined.length - 2;
    hours = Number(joined.slice(0, hourDigits));
    minutes = Number(joined.slice(hourDigits) || '0');
  } else {
    return null;
  }
  return hours < 24 && minutes < 60 ? toHhMm(hours, minutes) : null;
}

/** `HH:mm` of hours and minutes. */
export function toHhMm(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
