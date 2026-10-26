import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { bodyText, buttonByText, requireElement } from '@testing/dom';
import { scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonDeleteDialog } from './lesson-delete-dialog';

describe('LessonDeleteDialog', () => {
  let fixture: ComponentFixture<LessonDeleteDialog>;
  let backend: HttpTestingController;
  let deleted: string[];

  const series = scheduledLesson({
    seriesId: 'rule-1',
    repeatWeeks: 2,
    version: 3,
    repeatVersion: 5,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LessonDeleteDialog], providers: testProviders() });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonDeleteDialog);
    deleted = [];
    fixture.componentInstance.deleted.subscribe((id) => deleted.push(id));
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

  it('says what deleting does and deletes only this lesson by default', async () => {
    await open(series);
    expect(bodyText()).toContain('Занятие исчезнет из расписания');
    expect(bodyText()).toContain('Ученику придёт уведомление');

    buttonByText(document.body, 'Удалить').click();

    backend.expectOne('/api/teacher/schedule/lessons/l-1?version=3&repeatVersion=5').flush(null);
    await fixture.whenStable();
    expect(deleted).toEqual(['l-1']);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('keeps silent about the notification for a lesson that was cancelled', async () => {
    await open(scheduledLesson({ ...series, status: 'CANCELLED' }));

    expect(bodyText()).not.toContain('Ученику придёт уведомление');
  });

  it('previews the following lessons and sends both concurrency versions', async () => {
    await open(series);
    requireElement(document.body, '#lesson-scope-FOLLOWING', HTMLInputElement).click();
    await fixture.whenStable();

    buttonByText(document.body, 'Удалить').click();
    backend.expectNone((request) => request.method === 'DELETE');
    backend.expectOne('/api/teacher/schedule/lessons/l-1/following').flush({
      repeatVersion: 6,
      affected: ['l-1', 'l-2'],
      protectedLessons: ['l-3'],
    });
    await fixture.whenStable();
    expect(bodyText()).toContain('Существующих занятий для изменения: 2');
    buttonByText(document.body, 'Удалить').click();

    backend
      .expectOne('/api/teacher/schedule/lessons/l-1?scope=FOLLOWING&version=3&repeatVersion=6')
      .flush(null);
    await fixture.whenStable();
    expect(deleted).toEqual(['l-1']);
  });

  it('stays open and tells why when deleting fails', async () => {
    await open(series);

    buttonByText(document.body, 'Удалить').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1?version=3&repeatVersion=5')
      .flush({ code: 'schedule.lesson-charged' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();

    expect(deleted).toEqual([]);
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('does nothing without a lesson', async () => {
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();

    fixture.componentInstance.send();

    backend.expectNone(() => true);
  });
});
