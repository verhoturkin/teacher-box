/** A course of the teacher (ADR-0071): a named programme, e.g. «Английский A2». */
export interface Course {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly version: number;
}

/** Every current course of a student and of a group (`GET …/course-links`). */
export interface CourseLinks {
  readonly students: readonly { readonly studentId: string; readonly courseId: string }[];
  readonly groups: readonly { readonly groupId: string; readonly courseId: string }[];
}
