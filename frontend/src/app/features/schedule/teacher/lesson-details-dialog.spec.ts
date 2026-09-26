import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { at, changeRequest, scheduledLesson } from '@testing/schedule-fixtures';
import { ScheduledLesson } from '../data-access/schedule.models';
import { LessonDetailsDialog } from './lesson-details-dialog';

describe('LessonDetailsDialog', () => {
  let fixture: ComponentFixture<LessonDetailsDialog>;
  let backend: HttpTestingController;
  let changed: ScheduledLesson[];
  let edited: ScheduledLesson[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LessonDetailsDialog],
      providers: [provideHttpClient(), provideHttpClientTesting(), providePrimeNG()],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonDetailsDialog);
    changed = [];
    edited = [];
    fixture.componentInstance.changed.subscribe((lesson) => changed.push(lesson));
    fixture.componentInstance.edit.subscribe((lesson) => edited.push(lesson));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(lesson: ScheduledLesson, now = new Date(2026, 8, 30, 12)): Promise<void> {
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('lesson', lesson);
    fixture.componentRef.setInput('now', now);
    await fixture.whenStable();
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
  }

  it('shows the lesson and the student’s request', async () => {
    await open(
      scheduledLesson({
        topic: 'Дроби',
        meetingUrl: 'https://zoom.us/j/1',
        originalStartsAt: at(2026, 9, 30, 17),
        pendingRequest: changeRequest({ comment: 'Можно позже?' }),
      }),
    );

    const text = bodyText();
    expect(text).toContain('Иван Петров');
    expect(text).toContain('Запланировано');
    expect(text).toContain('Тема: Дроби');
    expect(text).toContain('Ссылка на урок');
    expect(text).toContain('Перенесено с');
    expect(text).toContain('Запрос ученика: Перенос');
    expect(text).toContain('«Можно позже?»');
    expect(text).not.toContain('Проведено');
  });

  it('hands a planned lesson over for editing', async () => {
    await open(scheduledLesson());

    buttonByText(document.body, 'Изменить').click();

    expect(edited.map((lesson) => lesson.id)).toEqual(['l-1']);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('marks the outcome of a started lesson', async () => {
    await open(scheduledLesson(), new Date(2026, 9, 1, 18, 30));

    buttonByText(document.body, 'Проведено').click();
    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/outcome');
    expect(request.request.body).toEqual({ outcome: 'CONDUCTED' });
    request.flush(scheduledLesson({ status: 'CONDUCTED' }));

    expect(changed.map((lesson) => lesson.status)).toEqual(['CONDUCTED']);
  });

  it('corrects and withdraws a marked outcome', async () => {
    await open(scheduledLesson({ status: 'CONDUCTED', cancelReason: 'x' }), new Date(2026, 9, 2));
    expect(bodyText()).toContain('Проведено');

    buttonByText(document.body, 'Пропуск').click();
    backend.expectOne('/api/teacher/schedule/lessons/l-1/outcome').flush(scheduledLesson({ status: 'MISSED' }));

    await open(scheduledLesson({ status: 'MISSED' }), new Date(2026, 9, 2));
    buttonByText(document.body, 'Снять отметку').click();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/l-1/outcome' })
      .flush(scheduledLesson());

    expect(changed.map((lesson) => lesson.status)).toEqual(['MISSED', 'SCHEDULED']);
  });

  it('cancels on the student’s behalf and charges it', async () => {
    await open(scheduledLesson());
    buttonByText(document.body, 'Отменить').click();
    await fixture.whenStable();
    typeInto(requireElement(document.body, '#lesson-cancel-reason', HTMLTextAreaElement), '  Заболел ');
    requireElement(document.body, '#lesson-cancel-by-student', HTMLInputElement).click();
    await fixture.whenStable();
    requireElement(document.body, '#lesson-cancel-charge', HTMLInputElement).click();
    await fixture.whenStable();

    buttonByText(document.body, 'Отменить занятие').click();

    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel');
    expect(request.request.body).toEqual({ reason: 'Заболел', byStudent: true, charge: true });
    request.flush(scheduledLesson({ status: 'MISSED' }));
    expect(changed).toHaveLength(1);
  });

  it('cancels by the teacher and can go back', async () => {
    await open(scheduledLesson());
    buttonByText(document.body, 'Отменить').click();
    await fixture.whenStable();
    buttonByText(document.body, 'Назад').click();
    await fixture.whenStable();
    buttonByText(document.body, 'Отменить').click();
    await fixture.whenStable();

    buttonByText(document.body, 'Отменить занятие').click();

    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel');
    expect(request.request.body).toEqual({ reason: null, byStudent: false, charge: false });
    request.flush(null, { status: 422, statusText: 'Unprocessable' });
    expect(changed).toHaveLength(0);
  });

  it('shows a cancelled lesson without actions', async () => {
    await open(scheduledLesson({ status: 'CANCELLED', cancelReason: 'Болезнь' }), new Date(2026, 9, 2));

    expect(bodyText()).toContain('Причина отмены: Болезнь');
    expect(() => buttonByText(document.body, 'Проведено')).toThrow();
    fixture.componentInstance.editLesson();
    fixture.componentRef.setInput('lesson', null);
    fixture.componentInstance.mark('CONDUCTED');
    fixture.componentInstance.editLesson();
    expect(edited).toHaveLength(1);
  });
});
