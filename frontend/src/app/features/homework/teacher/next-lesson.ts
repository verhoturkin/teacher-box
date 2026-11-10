import type { Observable } from 'rxjs';

/** What the hint reads of a lesson: a part of the lesson the schedule returns. */
export interface UpcomingLesson {
  readonly startsAt: string;
  readonly status: string;
  readonly studentId: string | null;
  readonly participants: readonly { readonly studentId: string }[];
}

/**
 * Reads the lessons that start on days `[from, to)` (`yyyy-MM-dd`). The editor's route gives it
 * (`app.routes.ts`): the lessons belong to the schedule, which homework does not import (ADR-0058).
 */
export type UpcomingLessons = (from: string, to: string) => Observable<readonly UpcomingLesson[]>;

/** How far ahead the editor looks for the next lesson of the chosen students. */
export const NEXT_LESSON_DAYS = 60;

/**
 * The start of the earliest scheduled lesson of any of the students after `now` (a group lesson counts for each
 * participant); `null` when none of them has one.
 */
export function nextLessonStart(
  lessons: readonly UpcomingLesson[],
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
