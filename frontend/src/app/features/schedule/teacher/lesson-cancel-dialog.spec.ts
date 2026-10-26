import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Snackbar } from '@core/snackbar/snackbar';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonCancelDialog } from './lesson-cancel-dialog';

describe('LessonCancelDialog', () => {
  let fixture: ComponentFixture<LessonCancelDialog>;
  let backend: HttpTestingController;
  let cancelled: ScheduledLesson[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LessonCancelDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonCancelDialog);
    cancelled = [];
    fixture.componentInstance.cancelled.subscribe((lesson) => cancelled.push(lesson));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(lesson: ScheduledLesson): Promise<void> {
    fixture.componentRef.setInput('lesson', lesson);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  }

  function cancel(): void {
    buttonByText(
      requireElement(document.body, '.p-dialog-footer', HTMLElement),
      'Отменить занятие',
    ).click();
  }

  it('cancels on behalf of the teacher with no reason by default', async () => {
    await open(scheduledLesson());

    cancel();

    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel');
    expect(request.request.body).toMatchObject({
      reason: null,
      byStudent: false,
      charge: false,
      scope: 'ONLY',
    });
    request.flush(scheduledLesson({ status: 'CANCELLED' }));
    expect(cancelled.map((lesson) => lesson.status)).toEqual(['CANCELLED']);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('cancels on the student initiative and charges it', async () => {
    await open(scheduledLesson());
    expect(document.body.querySelector('#lesson-cancel-charge')).toBeNull();
    typeInto(
      requireElement(document.body, '#lesson-cancel-reason', HTMLTextAreaElement),
      '  Заболел ',
    );
    requireElement(document.body, '#lesson-cancel-by-student', HTMLInputElement).click();
    await fixture.whenStable();
    requireElement(document.body, '#lesson-cancel-charge', HTMLInputElement).click();
    await fixture.whenStable();

    cancel();

    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel');
    expect(request.request.body).toMatchObject({
      reason: 'Заболел',
      byStudent: true,
      charge: true,
    });
    request.flush(scheduledLesson({ status: 'MISSED' }));
    expect(cancelled).toHaveLength(1);
  });

  it('does not charge a lesson the student did not cancel', async () => {
    await open(scheduledLesson());
    const byStudent = requireElement(document.body, '#lesson-cancel-by-student', HTMLInputElement);
    byStudent.click();
    await fixture.whenStable();
    requireElement(document.body, '#lesson-cancel-charge', HTMLInputElement).click();
    await fixture.whenStable();
    byStudent.click();
    await fixture.whenStable();

    cancel();

    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel');
    expect(request.request.body).toMatchObject({ byStudent: false, charge: false });
  });

  it('cancels a group lesson only on behalf of the teacher', async () => {
    await open(groupLesson());

    expect(document.body.querySelector('#lesson-cancel-by-student')).toBeNull();
  });

  it('shows the failure and stays open', async () => {
    await open(scheduledLesson());

    cancel();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/cancel')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(cancelled).toHaveLength(0);
    expect(fixture.componentInstance.visible()).toBe(true);
    expect(bodyText()).toContain('Не удалось отменить занятие');
  });

  it('does nothing without a lesson', async () => {
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();

    fixture.componentInstance.send();

    backend.expectNone(() => true);
  });

  describe('a lesson of a series', () => {
    const series = scheduledLesson({
      seriesId: 'rule-1',
      repeatWeeks: 2,
      version: 3,
      repeatVersion: 5,
    });

    it('cancels only this lesson by default and sends both versions', async () => {
      await open(series);

      cancel();

      const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel');
      expect(request.request.body).toMatchObject({ scope: 'ONLY', version: 3, repeatVersion: 5 });
      request.flush(scheduledLesson({ status: 'CANCELLED' }));
    });

    it('waits for the affected lessons before it cancels the following ones', async () => {
      await open(series);
      requireElement(document.body, '#lesson-scope-FOLLOWING', HTMLInputElement).click();
      await fixture.whenStable();

      cancel();
      backend.expectNone((request) => request.url.endsWith('/cancel'));
      backend.expectOne('/api/teacher/schedule/lessons/l-1/following').flush({
        repeatVersion: 6,
        affected: ['l-1', 'l-2'],
        protectedLessons: ['l-3'],
      });
      await fixture.whenStable();
      expect(bodyText()).toContain('Существующих занятий для изменения: 2');
      cancel();

      const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel');
      expect(request.request.body).toMatchObject({ scope: 'FOLLOWING', repeatVersion: 6 });
      request.flush(scheduledLesson({ status: 'CANCELLED' }));
    });

    it('starts with the single lesson every time it opens', async () => {
      await open(series);
      requireElement(document.body, '#lesson-scope-FOLLOWING', HTMLInputElement).click();
      await fixture.whenStable();
      backend.expectOne('/api/teacher/schedule/lessons/l-1/following').flush({
        repeatVersion: 5,
        affected: ['l-1'],
        protectedLessons: [],
      });
      fixture.componentRef.setInput('visible', false);
      await fixture.whenStable();

      await open(series);

      expect(bodyText()).not.toContain('Существующих занятий для изменения');
      cancel();
      const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel');
      expect(request.request.body).toMatchObject({ scope: 'ONLY' });
    });

    it('tells in a snackbar when the affected lessons could not be counted', async () => {
      const snackbar = vi.spyOn(fixture.debugElement.injector.get(Snackbar), 'error');
      await open(series);
      requireElement(document.body, '#lesson-scope-FOLLOWING', HTMLInputElement).click();
      await fixture.whenStable();

      backend
        .expectOne('/api/teacher/schedule/lessons/l-1/following')
        .flush(null, { status: 500, statusText: 'Error' });
      await fixture.whenStable();

      expect(snackbar).toHaveBeenCalledOnce();
      cancel();
      backend.expectNone((request) => request.url.endsWith('/cancel'));
    });
  });
});
