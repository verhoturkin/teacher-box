import { dayOf, earliestTime, joinDateTime, timeOf } from './date-time';

describe('date and time', () => {
  it('joins a day and a time into one moment and splits it back', () => {
    const moment = joinDateTime(new Date(2026, 10, 17), '09:05');

    expect(moment).toEqual(new Date(2026, 10, 17, 9, 5));
    expect(dayOf(moment)).toEqual(new Date(2026, 10, 17));
    expect(timeOf(moment)).toBe('09:05');
  });

  it('keeps no time before now today, rounded up to the step', () => {
    const now = new Date(2026, 10, 17, 14, 32, 10);

    expect(earliestTime(new Date(2026, 10, 17), now, 5)).toBe('14:35');
    expect(earliestTime(new Date(2026, 10, 17), now, 15)).toBe('14:45');
    expect(earliestTime(new Date(2026, 10, 17), new Date(2026, 10, 17, 14, 30), 5)).toBe('14:30');
  });

  it('allows any time on other days or without a bound', () => {
    const now = new Date(2026, 10, 17, 14, 32);

    expect(earliestTime(new Date(2026, 10, 18), now, 5)).toBeNull();
    expect(earliestTime(new Date(2026, 10, 17), null, 5)).toBeNull();
  });

  it('leaves no time late in the evening', () => {
    expect(earliestTime(new Date(2026, 10, 17), new Date(2026, 10, 17, 23, 58), 5)).toBe('24:00');
  });
});
