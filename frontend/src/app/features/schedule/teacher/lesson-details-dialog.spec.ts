import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { bodyText, buttonByText, menuItemByText, requireElement, typeInto } from '@testing/dom';
import { aBoard } from '@testing/boards-fixtures';
import { at, changeRequest, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import type { Board } from '@features/boards/parts';
import { ScheduledLesson } from '../data-access/schedule.models';
import { AttendanceDialog } from './attendance-dialog';
import { LessonDetailsDialog } from './lesson-details-dialog';
import { testProviders } from '@testing/setup';

describe('LessonDetailsDialog', () => {
  let fixture: ComponentFixture<LessonDetailsDialog>;
  let backend: HttpTestingController;
  let changed: ScheduledLesson[];
  let edited: ScheduledLesson[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LessonDetailsDialog],
      providers: testProviders(),
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

  async function open(
    lesson: ScheduledLesson,
    now = new Date(2026, 8, 30, 12),
    boards: Board[] = [],
  ): Promise<void> {
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

  /** Picks an action from the menu of the header. */
  async function choose(action: string): Promise<void> {
    buttonByText(document.body, 'Другие действия').click();
    await fixture.whenStable();
    menuItemByText(action).click();
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

    buttonByText(document.body, 'Изменить занятие').click();

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
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/outcome')
      .flush(scheduledLesson({ status: 'MISSED' }));

    await open(scheduledLesson({ status: 'MISSED' }), new Date(2026, 9, 2));
    await choose('Снять отметку');
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/l-1/outcome' })
      .flush(scheduledLesson());

    expect(changed.map((lesson) => lesson.status)).toEqual(['MISSED', 'SCHEDULED']);
  });

  it('cancels on the student’s behalf and charges it', async () => {
    await open(scheduledLesson());
    await choose('Отменить занятие…');
    typeInto(
      requireElement(document.body, '#lesson-cancel-reason', HTMLTextAreaElement),
      '  Заболел ',
    );
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
    await choose('Отменить занятие…');
    buttonByText(document.body, 'Отмена').click();
    await fixture.whenStable();
    await choose('Отменить занятие…');

    buttonByText(document.body, 'Отменить занятие').click();

    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/cancel');
    expect(request.request.body).toEqual({ reason: null, byStudent: false, charge: false });
    request.flush(null, { status: 422, statusText: 'Unprocessable' });
    expect(changed).toHaveLength(0);
  });

  it('deletes a lesson that was not held after a confirmation', async () => {
    const deleted: string[] = [];
    fixture.componentInstance.deleted.subscribe((id) => deleted.push(id));
    await open(scheduledLesson());
    await choose('Удалить…');
    expect(bodyText()).toContain('Ученику придёт уведомление, что занятие отменено');
    buttonByText(document.body, 'Отмена').click();
    await fixture.whenStable();
    expect(bodyText()).not.toContain('Ученику придёт уведомление');

    await choose('Удалить…');
    buttonByText(document.body, 'Удалить занятие').click();
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/l-1' }).flush(null);
    await fixture.whenStable();

    expect(deleted).toEqual(['l-1']);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('keeps the lesson when deleting fails and offers no deleting of a charged one', async () => {
    await open(scheduledLesson({ status: 'CANCELLED' }), new Date(2026, 9, 2));
    await choose('Удалить…');
    expect(bodyText()).not.toContain('Ученику придёт уведомление');
    buttonByText(document.body, 'Удалить занятие').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1')
      .flush({ code: 'schedule.lesson-charged' }, { status: 422, statusText: 'Unprocessable' });
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBe(true);

    await open(
      scheduledLesson({
        status: 'MISSED',
        participants: [{ studentId: 's-1', studentName: 'Иван Петров', attendance: 'MISSED' }],
      }),
    );
    buttonByText(document.body, 'Другие действия').click();
    await fixture.whenStable();
    expect(() => menuItemByText('Удалить')).toThrow();
    fixture.componentRef.setInput('lesson', null);
    fixture.componentInstance.deleteLesson();
    fixture.componentInstance.restore();
  });

  it('restores a cancelled lesson, also over another one', async () => {
    await open(scheduledLesson({ status: 'CANCELLED', cancelReason: 'Болезнь' }));
    buttonByText(document.body, 'Восстановить').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/restore')
      .flush({ status: 409, code: 'schedule.overlap' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(bodyText()).toContain('В это время уже есть другое занятие');

    buttonByText(document.body, 'Всё равно восстановить').click();
    const again = backend.expectOne('/api/teacher/schedule/lessons/l-1/restore');
    expect(again.request.body).toEqual({ allowOverlap: true });
    again.flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect(bodyText()).toContain('Не удалось восстановить занятие');

    buttonByText(document.body, 'Восстановить').click();
    const restored = backend.expectOne('/api/teacher/schedule/lessons/l-1/restore');
    expect(restored.request.body).toEqual({ allowOverlap: false });
    restored.flush(scheduledLesson());
    await fixture.whenStable();
    expect(changed).toHaveLength(1);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('keeps one red button in the footer and the dangerous actions in the menu', async () => {
    await open(scheduledLesson(), new Date(2026, 9, 1, 18, 30));

    const footer = requireElement(document.body, '.p-dialog-footer', HTMLElement);
    expect(footer.querySelectorAll('.p-button-danger:not(.p-button-text)')).toHaveLength(1);
    expect(footer.querySelectorAll('.p-button-danger.p-button-text')).toHaveLength(0);
    expect(footer.textContent).not.toContain('Удалить');
    expect(footer.textContent).not.toContain('Отменить');
    buttonByText(document.body, 'Другие действия').click();
    await fixture.whenStable();
    expect(menuItemByText('Удалить…').closest('li')?.className).toContain('tb-menu-item--danger');
  });

  it('takes its width from a class, not from a style of the place (ADR-0026)', async () => {
    await open(scheduledLesson());

    const dialog = requireElement(document.body, '.p-dialog', HTMLElement);
    expect(dialog.classList).toContain('tb-dialog');
    expect(dialog.style.width).toBe('');
  });

  it('puts the focus on the title, not on a button', async () => {
    await open(scheduledLesson({ joinUrl: 'https://zoom.us/j/1' }));

    const title = requireElement(document.body, '.p-dialog-title', HTMLElement);
    expect(title.getAttribute('tabindex')).toBe('-1');
    fixture.componentInstance.focusTitle();
    expect(document.activeElement).toBe(title);
  });

  it('shows a cancelled lesson without actions', async () => {
    await open(
      scheduledLesson({ status: 'CANCELLED', cancelReason: 'Болезнь' }),
      new Date(2026, 9, 2),
    );

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
        pendingRequests: [
          changeRequest({ kind: 'CANCEL', groupId: 'g-1', studentName: 'Мария', comment: 'Болею' }),
        ],
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
    fixture.debugElement
      .query(By.directive(AttendanceDialog))
      .injector.get(AttendanceDialog)
      .saved.emit(groupLesson({ status: 'CONDUCTED' }));
    expect(changed.map((lesson) => lesson.status)).toEqual(['CONDUCTED']);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('cancels a group lesson only on behalf of the teacher', async () => {
    await open(groupLesson());

    await choose('Отменить занятие…');

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
