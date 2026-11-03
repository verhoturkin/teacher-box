import { dayTime, fromIsoDate, fromIsoMonth, toIsoDate, toIsoMonth, monthLabel } from './iso-date';

describe('iso dates', () => {
  it('formats local dates without time zone shifts', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toIsoMonth(new Date(2026, 8, 30))).toBe('2026-09');
  });

  it('parses dates and months', () => {
    const date = fromIsoDate('2026-09-07');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 8, 7]);
    expect(toIsoDate(fromIsoMonth('2026-02'))).toBe('2026-02-01');
  });

  it('defaults missing month and day to the first', () => {
    expect(toIsoDate(fromIsoDate('2026-9'))).toBe('2026-09-01');
    expect(toIsoDate(fromIsoDate('2026'))).toBe('2026-01-01');
  });

  it('names a month in words', () => {
    expect(monthLabel('2026-09')).toBe('сентябрь 2026 г.');
    expect(monthLabel('2026-01')).toContain('январь');
    expect(monthLabel('bad')).toBe('bad');
  });

  it('names today and yesterday and dates the older moments', () => {
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 21, 3);
    const old = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5, 16, 20);
    expect(dayTime(now.toISOString())).toMatch(/^сегодня, \d{2}:\d{2}$/);
    expect(dayTime(yesterday.toISOString(), true)).toBe('Вчера, 21:03');
    expect(dayTime(old.toISOString())).toMatch(/^\d{1,2} \S+, 16:20$/);
  });
});
