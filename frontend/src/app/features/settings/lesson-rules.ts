import type { LessonRules } from '@features/schedule/parts';

/** Minutes in an hour: the rules travel in minutes, the fields show hours. */
export const HOUR = 60;

/** The same rules, the reminders in any order. */
export function sameRules(a: LessonRules, b: LessonRules): boolean {
  return (
    a.defaultDurationMinutes === b.defaultDurationMinutes &&
    a.lateCancellationMinutes === b.lateCancellationMinutes &&
    a.horizonWeeks === b.horizonWeeks &&
    a.workStart === b.workStart &&
    a.workEnd === b.workEnd &&
    a.reminderMinutes.length === b.reminderMinutes.length &&
    a.reminderMinutes.every((minutes) => b.reminderMinutes.includes(minutes))
  );
}
