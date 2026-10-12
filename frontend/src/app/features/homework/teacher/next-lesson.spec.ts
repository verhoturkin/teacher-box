import { at, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { nextLessonStart } from './next-lesson';

describe('nextLessonStart', () => {
  const now = new Date(at(2026, 10, 1, 12));

  it('finds the earliest scheduled lesson of any chosen student', () => {
    const lessons = [
      scheduledLesson({ id: 'later', startsAt: at(2026, 10, 5, 18) }),
      groupLesson({ id: 'group', startsAt: at(2026, 10, 3, 18) }),
      scheduledLesson({ id: 'past', startsAt: at(2026, 9, 30, 18) }),
      scheduledLesson({ id: 'cancelled', startsAt: at(2026, 10, 2, 18), status: 'CANCELLED' }),
      scheduledLesson({
        id: 'other',
        studentId: 's-9',
        participants: [],
        startsAt: at(2026, 10, 1, 18),
      }),
    ];

    expect(nextLessonStart(lessons, ['s-2'], now)?.toISOString()).toBe(at(2026, 10, 3, 18));
    expect(nextLessonStart(lessons, ['s-1'], now)?.toISOString()).toBe(at(2026, 10, 3, 18));
    expect(nextLessonStart(lessons, ['s-9'], now)?.toISOString()).toBe(at(2026, 10, 1, 18));
    expect(nextLessonStart(lessons, [], now)).toBeNull();
    expect(nextLessonStart([], ['s-1'], now)).toBeNull();
  });
});
