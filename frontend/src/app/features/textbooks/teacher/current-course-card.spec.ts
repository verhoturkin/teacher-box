import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgModel } from '@angular/forms';
import { aCourse } from '@testing/textbooks-fixtures';
import { bodyText } from '@testing/dom';
import { testProviders } from '@testing/setup';
import { CurrentCourseCard } from './current-course-card';

describe('CurrentCourseCard', () => {
  let fixture: ComponentFixture<CurrentCourseCard>;
  let backend: HttpTestingController;
  let changed: (string | null)[];

  async function render(kind: 'STUDENT' | 'GROUP', courseId: string | null): Promise<void> {
    TestBed.configureTestingModule({ imports: [CurrentCourseCard], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CurrentCourseCard);
    changed = [];
    fixture.componentInstance.changed.subscribe((id) => changed.push(id));
    fixture.componentRef.setInput('owner', { kind, id: 'x-1' });
    fixture.componentRef.setInput('courses', [aCourse({ id: 'a2', name: 'A2' })]);
    fixture.componentRef.setInput('courseId', courseId);
    await fixture.whenStable();
  }

  const model = (): NgModel =>
    fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
  function choose(courseId: string | null): void {
    fixture.debugElement
      .query(By.directive(NgModel))
      .triggerEventHandler('ngModelChange', courseId);
  }

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('saves the student’s course as soon as it is chosen', async () => {
    await render('STUDENT', null);
    expect(bodyText()).toContain('Курс, который ученик проходит сейчас');
    choose('a2');
    choose('a2');
    const request = backend.expectOne({
      method: 'PUT',
      url: '/api/teacher/textbooks/students/x-1/course',
    });
    expect(request.request.body).toEqual({ courseId: 'a2' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(changed).toEqual(['a2']);
  });

  it('puts back the group’s course when the server refuses it', async () => {
    await render('GROUP', 'a2');
    expect(bodyText()).toContain('Курс, который группа проходит сейчас');
    choose(null);
    backend
      .expectOne({ method: 'PUT', url: '/api/teacher/textbooks/groups/x-1/course' })
      .flush(null, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();
    expect(changed).toEqual([]);
    expect(model().model).toBe('a2');
  });
});
