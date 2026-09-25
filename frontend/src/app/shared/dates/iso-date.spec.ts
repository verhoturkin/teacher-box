import { fromIsoDate, fromIsoMonth, toIsoDate, toIsoMonth } from './iso-date';

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
});
