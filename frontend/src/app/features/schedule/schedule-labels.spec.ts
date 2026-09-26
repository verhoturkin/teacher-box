import { at } from '@testing/schedule-fixtures';
import {
  browserTimeZone,
  formatLessonStart,
  formatLessonTime,
  formatWeekly,
  optionalText,
  widen,
} from './schedule-labels';

describe('schedule labels', () => {
  it('formats lesson times in the browser time zone', () => {
    expect(formatLessonStart(at(2026, 10, 1, 18, 5))).toMatch(/^чт, 01\.10(,| в)? 18:05$/);
    expect(formatLessonTime(at(2026, 10, 1, 18), at(2026, 10, 1, 19, 30))).toMatch(/18:00–19:30$/);
  });

  it('describes weekly series in the order of the week', () => {
    expect(formatWeekly(['THURSDAY', 'MONDAY'], '18:00:00')).toBe('Пн, Чт в 18:00');
  });

  it('knows the browser time zone', () => {
    expect(browserTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('trims optional texts', () => {
    expect(optionalText('  Дроби ')).toBe('Дроби');
    expect(optionalText('   ')).toBeNull();
  });

  it('widens a calendar range by a day on each side', () => {
    expect(widen({ from: '2026-10-01', to: '2026-11-01' })).toEqual({ from: '2026-09-30', to: '2026-11-02' });
  });
});
