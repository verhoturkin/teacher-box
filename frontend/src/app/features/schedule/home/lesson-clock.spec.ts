import { at, scheduledLesson } from '@testing/schedule-fixtures';
import { lessonTime } from './lesson-clock';

describe('lessonTime', () => {
  // the lesson of the fixture: 01.10.2026, 18:00–19:00 local time
  const lesson = scheduledLesson();

  function timeAt(moment: string): ReturnType<typeof lessonTime> {
    return lessonTime(lesson, new Date(moment).getTime());
  }

  it('shows today with the duration more than an hour before the start', () => {
    expect(timeAt(at(2026, 10, 1, 9))).toEqual({
      phase: 'upcoming',
      day: 'Сегодня',
      start: '18:00',
      note: '60 мин',
    });
  });

  it('counts down within an hour of the start', () => {
    expect(timeAt(at(2026, 10, 1, 17, 35)).note).toBe('через 25 мин');
    expect(timeAt(at(2026, 10, 1, 17)).note).toBe('через 60 мин');
    expect(lessonTime(lesson, new Date(at(2026, 10, 1, 18)).getTime() - 1000).note).toBe(
      'через 1 мин',
    );
  });

  it('says tomorrow the day before and the weekday with the date later', () => {
    expect(timeAt(at(2026, 9, 30, 23, 30)).day).toBe('Завтра');
    expect(timeAt(at(2026, 9, 28, 10)).day).toBe('чт, 01.10');
  });

  it('shows how much is left while the lesson runs', () => {
    expect(timeAt(at(2026, 10, 1, 18, 40))).toEqual({
      phase: 'live',
      day: 'Идёт сейчас',
      start: '18:00',
      note: 'ещё 20 мин',
    });
  });

  it('is over at the end', () => {
    expect(timeAt(at(2026, 10, 1, 19)).phase).toBe('over');
  });
});
