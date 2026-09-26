import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText } from '@testing/dom';
import { scheduledLesson } from '@testing/schedule-fixtures';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonDialog } from './lesson-dialog';

describe('LessonDialog', () => {
  let fixture: ComponentFixture<LessonDialog>;
  let backend: HttpTestingController;
  let saved: ScheduledLesson[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LessonDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonDialog);
    fixture.componentRef.setInput('students', [
      { id: 's-1', displayName: 'Иван' },
      { id: 's-2', displayName: 'Мария' },
    ]);
    fixture.componentRef.setInput('defaultDuration', 45);
    saved = [];
    fixture.componentInstance.saved.subscribe((lesson) => saved.push(lesson));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(lesson: ScheduledLesson | null = null, slot: { start: Date; durationMinutes: number } | null = null) {
    fixture.componentRef.setInput('lesson', lesson);
    fixture.componentRef.setInput('slot', slot);
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('plans a lesson in the selected slot', async () => {
    const start = new Date(2026, 9, 1, 18, 0);
    const dialog = await open(null, { start, durationMinutes: 90 });
    expect(bodyText()).toContain('Новое занятие');
    expect(dialog.form.getRawValue()).toEqual(
      expect.objectContaining({ studentId: null, startsAt: start, durationMinutes: 90 }),
    );
    dialog.form.patchValue({ studentId: 's-2', topic: '  Дроби ', meetingUrl: 'https://zoom.us/j/1' });
    await fixture.whenStable();

    buttonByText(document.body, 'Сохранить').click();

    const request = backend.expectOne({ method: 'POST', url: '/api/teacher/schedule/lessons' });
    expect(request.request.body).toEqual({
      studentId: 's-2',
      startsAt: start.toISOString(),
      durationMinutes: 90,
      topic: 'Дроби',
      meetingUrl: 'https://zoom.us/j/1',
      allowOverlap: false,
    });
    request.flush(scheduledLesson());
    expect(saved).toHaveLength(1);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('offers to save an overlapping lesson anyway', async () => {
    const dialog = await open();
    dialog.form.patchValue({ studentId: 's-1', startsAt: new Date(2026, 9, 1, 18) });
    expect(dialog.form.controls.durationMinutes.value).toBe(45);

    dialog.save();
    backend
      .expectOne('/api/teacher/schedule/lessons')
      .flush({ status: 409, code: 'schedule.overlap' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(bodyText()).toContain('Время пересекается с другим занятием');

    buttonByText(document.body, 'Всё равно сохранить').click();
    const retry = backend.expectOne('/api/teacher/schedule/lessons');
    expect(retry.request.body).toEqual(expect.objectContaining({ allowOverlap: true, topic: null, meetingUrl: null }));
    retry.flush(scheduledLesson());
    expect(saved).toHaveLength(1);
  });

  it('shows other errors and rejects bad links', async () => {
    const dialog = await open();
    dialog.form.patchValue({ studentId: 's-1', startsAt: new Date(2026, 9, 1, 18), meetingUrl: 'zoom' });
    await fixture.whenStable();
    expect(dialog.form.invalid).toBe(true);
    expect(bodyText()).toContain('Ссылка должна начинаться с http:// или https://');
    dialog.save();

    dialog.form.patchValue({ meetingUrl: '' });
    dialog.save();
    backend
      .expectOne('/api/teacher/schedule/lessons')
      .flush({ status: 404, code: 'schedule.student-not-found' }, { status: 404, statusText: 'Not Found' });
    await fixture.whenStable();

    expect(bodyText()).toContain('Ученик не найден или отключён');
    expect(saved).toHaveLength(0);
  });

  it('keeps what is typed when inputs change while it is open', async () => {
    const dialog = await open();
    dialog.form.patchValue({ studentId: 's-1', topic: 'Дроби' });

    fixture.componentRef.setInput('defaultDuration', 60);
    fixture.componentRef.setInput('students', [{ id: 's-1', displayName: 'Иван' }]);
    await fixture.whenStable();

    expect(dialog.form.getRawValue()).toEqual(expect.objectContaining({ studentId: 's-1', topic: 'Дроби' }));
  });

  it('changes a planned lesson', async () => {
    const lesson = scheduledLesson({ topic: 'Степени', meetingUrl: 'https://zoom.us/j/2' });
    const dialog = await open(lesson);
    expect(bodyText()).toContain('Изменить занятие');
    expect(dialog.form.controls.studentId.disabled).toBe(true);
    expect(dialog.form.controls.startsAt.value).toEqual(new Date(lesson.startsAt));

    dialog.form.patchValue({ durationMinutes: 30 });
    dialog.save();

    const request = backend.expectOne({ method: 'PUT', url: '/api/teacher/schedule/lessons/l-1' });
    expect(request.request.body).toEqual({
      startsAt: lesson.startsAt,
      durationMinutes: 30,
      topic: 'Степени',
      meetingUrl: 'https://zoom.us/j/2',
      allowOverlap: false,
    });
    request.flush(lesson);
    expect(saved).toEqual([lesson]);
  });
});
