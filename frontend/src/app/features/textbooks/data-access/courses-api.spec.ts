import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { testProviders } from '@testing/setup';
import { CoursesApi } from './courses-api';

describe('CoursesApi', () => {
  let api: CoursesApi;
  let backend: HttpTestingController;
  const course = { id: 'c-1', name: 'A2', position: 0, version: 3 };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    api = TestBed.inject(CoursesApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('lists, creates, renames, reorders and deletes courses', () => {
    let listed: unknown;
    api.list().subscribe((list) => (listed = list));
    backend.expectOne({ method: 'GET', url: '/api/teacher/textbooks/courses' }).flush([course]);
    expect(listed).toEqual([course]);

    api.create('B1').subscribe();
    const created = backend.expectOne({ method: 'POST', url: '/api/teacher/textbooks/courses' });
    expect(created.request.body).toEqual({ name: 'B1' });
    created.flush(course);

    api.rename(course, 'A2+').subscribe();
    const renamed = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/courses/c-1' });
    expect(renamed.request.body).toEqual({ name: 'A2+', version: 3 });
    renamed.flush(course);

    api.reorder(['c-2', 'c-1']).subscribe();
    const order = backend.expectOne({ method: 'PUT', url: '/api/teacher/textbooks/courses/order' });
    expect(order.request.body).toEqual({ ids: ['c-2', 'c-1'] });
    order.flush([]);

    let removed = false;
    api.remove('c-1').subscribe(() => (removed = true));
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/textbooks/courses/c-1' })
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(removed).toBe(true);
  });

  it('reads and sets the current courses of students and groups', () => {
    let links: unknown;
    api.links().subscribe((value) => (links = value));
    backend
      .expectOne({ method: 'GET', url: '/api/teacher/textbooks/course-links' })
      .flush({ students: [{ studentId: 's-1', courseId: 'c-1' }], groups: [] });
    expect(links).toEqual({ students: [{ studentId: 's-1', courseId: 'c-1' }], groups: [] });

    let done = 0;
    api.setStudentCourse('s-1', 'c-1').subscribe(() => done++);
    const student = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/textbooks/students/s-1/course',
    });
    expect(student.request.body).toEqual({ courseId: 'c-1' });
    student.flush(null, { status: 204, statusText: 'No Content' });

    api.setGroupCourse('g-1', null).subscribe(() => done++);
    const group = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/textbooks/groups/g-1/course',
    });
    expect(group.request.body).toEqual({ courseId: null });
    group.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBe(2);
  });
});
