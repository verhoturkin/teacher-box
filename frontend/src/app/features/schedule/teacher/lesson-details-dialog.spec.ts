import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { providePrimeNG } from 'primeng/config';
import { bodyText, buttonByText, requireElement, typeInto } from '@testing/dom';
import { aBoard } from '@testing/boards-fixtures';
import { at, changeRequest, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import type { Board } from '@features/boards/parts';
import { ScheduledLesson } from '../data-access/schedule.models';
import { AttendanceDialog } from './attendance-dialog';
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

  async function open(lesson: ScheduledLesson, now = new Date(2026, 8, 30, 12), boards: Board[] = []): Promise<void> {
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('lesson', lesson);
    fixture.componentRef.setInput('now', now);
    await fixture.whenStable();
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    for (const request of backend.match('/api/teacher/boards')) {
      request.flush(boards);
    }
    await fixture.whenStable();
  }

  it('shows the lesson and the student’s request', async () => {
    await open(
      scheduledLesson({
        topic: 'Дроби',
        joinUrl: 'https://zoom.us/j/1',
        originalStartsAt: at(2026, 9, 30, 17),
        pendingRequests: [changeRequest({ comment: 'Можно позже?' })],
      }),
    );

    const text = bodyText();
    expect(text).toContain('Иван Петров');
    expect(text).toContain('Запланировано');
    expect(text).toContain('Тема: Дроби');
    expect(text).toContain('Начать урок');
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

  it('shows the students of a group lesson and opens their attendance', async () => {
    await open(
      groupLesson({
        startsAt: at(2026, 9, 29, 18),
        endsAt: at(2026, 9, 29, 19, 30),
        pendingRequests: [changeRequest({ kind: 'CANCEL', groupId: 'g-1', studentName: 'Мария', comment: 'Болею' })],
      }),
    );

    const text = bodyText();
    expect(text).toContain('Группа «ОГЭ»');
    expect(text).toContain('Мария');
    expect(text).toContain('Предупредил');
    expect(text).toContain('Мария: Не придёт');
    expect(() => buttonByText(document.body, 'Проведено')).toThrow();

    buttonByText(document.body, 'Отметить посещаемость').click();
    await fixture.whenStable();
    expect(bodyText()).toContain('Кто был на занятии');
    fixture.debugElement.query(By.directive(AttendanceDialog)).injector.get(AttendanceDialog).saved
      .emit(groupLesson({ status: 'CONDUCTED' }));
    expect(changed.map((lesson) => lesson.status)).toEqual(['CONDUCTED']);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('cancels a group lesson only on behalf of the teacher', async () => {
    await open(groupLesson());

    buttonByText(document.body, 'Отменить').click();
    await fixture.whenStable();

    expect(document.body.querySelector('#lesson-cancel-by-student')).toBeNull();
  });

  it('links the boards of the lesson', async () => {
    await open(groupLesson(), new Date(2026, 8, 30, 12), [
      aBoard({ ownerType: 'GROUP', ownerId: 'g-1', title: 'Доска группы' }),
      aBoard({ id: 'board-2', ownerId: 's-1', title: 'Личная доска' }),
    ]);

    expect(bodyText()).toContain('Доска группы');
    expect(bodyText()).not.toContain('Личная доска');
  });
});
