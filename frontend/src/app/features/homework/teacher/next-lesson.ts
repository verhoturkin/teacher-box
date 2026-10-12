import type { ScheduledLesson } from '@features/schedule/parts';

/** How far ahead the editor looks for the next lesson of the chosen students. */
export const NEXT_LESSON_DAYS = 60;

/**
 * The start of the earliest scheduled lesson of any of the students after `now` (a group lesson counts for each
 * participant); `null` when none of them has one.
 */
export function nextLessonStart(
  lessons: readonly ScheduledLesson[],
  studentIds: readonly string[],
  now: Date,
): Date | null {
  const chosen = new Set(studentIds);
  let next: Date | null = null;
  for (const lesson of lessons) {
    const starts = new Date(lesson.startsAt);
    const theirs =
      (lesson.studentId !== null && chosen.has(lesson.studentId)) ||
      lesson.participants.some((participant) => chosen.has(participant.studentId));
    if (
      lesson.status === 'SCHEDULED' &&
      theirs &&
      starts.getTime() > now.getTime() &&
      (next === null || starts.getTime() < next.getTime())
    ) {
      next = starts;
    }
  }
  return next;
}
