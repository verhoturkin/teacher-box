import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Course, CourseLinks } from './courses.models';

const COURSES = '/api/teacher/textbooks/courses';

/** HTTP client of the courses and the current courses of students and groups (ADR-0071). */
@Injectable({ providedIn: 'root' })
export class CoursesApi {
  private readonly http = inject(HttpClient);

  /** In the teacher's order. */
  list(context?: HttpContext): Observable<Course[]> {
    return this.http.get<Course[]>(COURSES, { context });
  }

  create(name: string): Observable<Course> {
    return this.http.post<Course>(COURSES, { name });
  }

  rename(course: Course, name: string): Observable<Course> {
    return this.http.put<Course>(`${COURSES}/${course.id}`, { name, version: course.version });
  }

  /** The list names every course once. */
  reorder(ids: readonly string[]): Observable<Course[]> {
    return this.http.put<Course[]>(`${COURSES}/order`, { ids });
  }

  /** Its textbooks, students and groups are left without a course. */
  remove(courseId: string): Observable<void> {
    return this.http.delete(`${COURSES}/${courseId}`).pipe(map(() => undefined));
  }

  links(context?: HttpContext): Observable<CourseLinks> {
    return this.http.get<CourseLinks>('/api/teacher/textbooks/course-links', { context });
  }

  /** `null` — no course. */
  setStudentCourse(studentId: string, courseId: string | null): Observable<void> {
    return this.http
      .put(`/api/teacher/textbooks/students/${studentId}/course`, { courseId })
      .pipe(map(() => undefined));
  }

  /** `null` — no course. */
  setGroupCourse(groupId: string, courseId: string | null): Observable<void> {
    return this.http
      .put(`/api/teacher/textbooks/groups/${groupId}/course`, { courseId })
      .pipe(map(() => undefined));
  }
}
