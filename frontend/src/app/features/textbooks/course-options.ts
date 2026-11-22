import { Course } from './data-access/courses.models';
import { T } from './i18n/texts';

/** An option of a «Курс» select: `null` — «Без курса». */
export interface CourseOption {
  readonly value: string | null;
  readonly label: string;
}

/** «Без курса» and the courses in the teacher's order, for a «Курс» select (ADR-0071). */
export function courseOptions(courses: readonly Pick<Course, 'id' | 'name'>[]): CourseOption[] {
  return [
    { value: null, label: T.courses.none },
    ...courses.map((course) => ({ value: course.id, label: course.name })),
  ];
}

/** How many items each course has, by the course id; `null` — the items without a course. */
export function countByCourse(
  items: readonly { readonly courseId: string | null }[],
): ReadonlyMap<string | null, number> {
  const counts = new Map<string | null, number>();
  for (const item of items) {
    counts.set(item.courseId, (counts.get(item.courseId) ?? 0) + 1);
  }
  return counts;
}
