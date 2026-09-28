import {
  at,
  changeRequest,
  groupLesson,
  onceOffTime,
  scheduledLesson,
  weeklyOffTime,
} from '@testing/schedule-fixtures';
import {
  browserTimeZone,
  formatLessonStart,
  formatLessonTime,
  formatOffTime,
  formatWeekly,
  lessonWith,
  optionalText,
  requestKindLabel,
  widen,
} from './schedule-labels';

describe('schedule labels', () => {
  it('formats lesson times in the browser time zone', () => {
    expect(formatLessonStart(at(2026, 10, 1, 18, 5))).toMatch(/^чт, 01\.10(,| в)? 18:05$/);
    expect(formatLessonTime(at(2026, 10, 1, 18), at(2026, 10, 1, 19, 30))).toMatch(/18:00–19:30$/);
  });

  it('names the student or the group of a lesson', () => {
    expect(lessonWith(groupLesson())).toBe('Группа «ОГЭ»');
    expect(lessonWith(groupLesson({ groupName: null }))).toBe('Группа «без названия»');
    expect(lessonWith(scheduledLesson())).toBe('Иван Петров');
    expect(lessonWith(scheduledLesson({ studentName: null }))).toBe('Ученик');
  });

  it('calls a cancellation in a group lesson an absence', () => {
    expect(requestKindLabel(changeRequest({ kind: 'CANCEL', groupId: 'g-1' }))).toBe('Не придёт');
    expect(requestKindLabel(changeRequest({ kind: 'CANCEL' }))).toBe('Отмена');
    expect(requestKindLabel(changeRequest({ groupId: 'g-1' }))).toBe('Перенос');
  });

  it('describes weekly series in the order of the week', () => {
    expect(formatWeekly(['THURSDAY', 'MONDAY'], '18:00:00')).toBe('Пн, Чт в 18:00');
  });

  it('describes off time once and weekly', () => {
    expect(
      formatOffTime(onceOffTime({ startsAt: at(2026, 10, 1, 13), endsAt: at(2026, 10, 1, 14) })),
    ).toBe('чт, 01.10, 13:00–14:00');
    expect(formatOffTime(onceOffTime())).toBe('пн, 05.10, 00:00 – сб, 10.10, 00:00');
    expect(formatOffTime(weeklyOffTime())).toBe('Пн, Ср 13:00–14:00');
    expect(
      formatOffTime(
        weeklyOffTime({
          weekdays: ['SATURDAY'],
          startTime: '00:00:00',
          endTime: '00:00:00',
          endsOn: '2026-12-31',
        }),
      ),
    ).toBe('Сб 00:00–00:00, по 31.12.2026');
    expect(formatOffTime(weeklyOffTime({ startsOn: '2999-01-01', endsOn: '2999-02-01' }))).toBe(
      'Пн, Ср 13:00–14:00, с 01.01.2999 по 01.02.2999',
    );
  });

  it('knows the browser time zone', () => {
    expect(browserTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('trims optional texts', () => {
    expect(optionalText('  Дроби ')).toBe('Дроби');
    expect(optionalText('   ')).toBeNull();
  });

  it('widens a calendar range by a day on each side', () => {
    expect(widen({ from: '2026-10-01', to: '2026-11-01' })).toEqual({
      from: '2026-09-30',
      to: '2026-11-02',
    });
  });
});
