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
