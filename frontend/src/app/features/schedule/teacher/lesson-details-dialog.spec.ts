import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
import { Snackbar } from '@core/snackbar/snackbar';
import { bodyText, buttonByText, menuItemByText, requireElement, typeInto } from '@testing/dom';
import { at, changeRequest, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { testProviders } from '@testing/setup';
import { ChangeRequest, ScheduledLesson } from '../data-access/schedule.models';
import { AttendanceDialog } from './attendance-dialog';
import { LessonCancelDialog } from './lesson-cancel-dialog';
import { LessonDeleteDialog } from './lesson-delete-dialog';
import { LessonDetailsDialog } from './lesson-details-dialog';

const FUTURE = new Date(2026, 8, 30, 12);
const PAST = new Date(2026, 9, 2);

/** The option of the «Итог» toggle with this text. */
function toggle(text: string): HTMLElement {
  const option = Array.from(document.body.querySelectorAll<HTMLElement>('p-togglebutton')).find(
    (candidate) => candidate.textContent.includes(text),
  );
  if (option === undefined) {
    throw new Error(`Toggle "${text}" not found`);
  }
  return option;
}

describe('LessonDetailsDialog', () => {
  let fixture: ComponentFixture<LessonDetailsDialog>;
  let backend: HttpTestingController;
  let changed: ScheduledLesson[];
  let edited: ScheduledLesson[];
  let deleted: string[];
  let answered: ChangeRequest[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LessonDetailsDialog],
      providers: testProviders(),
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LessonDetailsDialog);
    changed = [];
    edited = [];
    deleted = [];
    answered = [];
    fixture.componentInstance.changed.subscribe((lesson) => changed.push(lesson));
    fixture.componentInstance.edit.subscribe((lesson) => edited.push(lesson));
    fixture.componentInstance.deleted.subscribe((id) => deleted.push(id));
    fixture.componentInstance.answerOpened.subscribe((request) => answered.push(request));
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  async function open(lesson: ScheduledLesson, now = FUTURE): Promise<void> {
    fixture.componentRef.setInput('visible', false);
    fixture.componentRef.setInput('lesson', lesson);
    fixture.componentRef.setInput('now', now);
    await fixture.whenStable();
    fixture.componentRef.setInput('visible', true);
    await fixture.whenStable();
    for (const request of backend.match((request) => request.url === '/api/teacher/boards')) {
      request.flush([]);
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

  function pressed(): string[] {
    return Array.from(
      document.body.querySelectorAll('.p-togglebutton-checked:not(tb-lesson-summary *)'),
    ).map((button) => button.textContent.trim());
  }

  /** The next confirmation the dialog asks for (the host of confirmations lives in `App`). */
  function expectConfirmation() {
    const confirm = vi.spyOn(TestBed.inject(ConfirmationService), 'confirm');
    return () => {
      const confirmation = confirm.mock.calls.at(-1)?.[0];
      if (confirmation === undefined) {
        throw new Error('no confirmation was asked');
      }
      return confirmation;
    };
  }

  it('names who the lesson is with and lists its facts', async () => {
    await open(scheduledLesson({ topic: 'Дроби', joinUrl: 'https://zoom.us/j/1' }));

    const title = document.body.querySelector('.p-dialog-title');
    expect(title?.textContent).toContain('Иван Петров');
    const text = bodyText();
    expect(text).toContain('Дроби');
    expect(text).toContain('Начать урок');
    expect(text).not.toContain('Запланировано');
    expect(text).not.toContain('Проведено');
  });

  it('has no footer for a lesson to come or a past one with one student', async () => {
    await open(scheduledLesson());
    expect(document.body.querySelector('.p-dialog-footer button')).toBeNull();

    await open(scheduledLesson(), PAST);
    expect(document.body.querySelector('.p-dialog-footer button')).toBeNull();
    expect(bodyText()).toContain('Итог');
  });

  it('hands a planned lesson over for editing', async () => {
    await open(scheduledLesson());

    buttonByText(document.body, 'Изменить занятие').click();

    expect(edited.map((lesson) => lesson.id)).toEqual(['l-1']);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('offers no editing of a lesson that was not planned', async () => {
    await open(scheduledLesson({ status: 'CANCELLED' }), PAST);

    expect(() => buttonByText(document.body, 'Изменить занятие')).toThrow();
  });

  it('closes and opens the answer to a request of the student', async () => {
    const request = changeRequest({ comment: 'Можно позже?' });
    await open(scheduledLesson({ pendingRequests: [request] }));

    buttonByText(document.body, 'Ответить').click();

    expect(answered).toEqual([request]);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('marks the outcome of a past lesson by the toggle and shows the saved one', async () => {
    await open(scheduledLesson(), PAST);

    toggle('Проведено').click();
    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/outcome');
    expect(request.request.body).toMatchObject({ outcome: 'CONDUCTED' });
    request.flush(scheduledLesson({ status: 'CONDUCTED' }));
    await fixture.whenStable();

    expect(changed.map((lesson) => lesson.status)).toEqual(['CONDUCTED']);
    expect(fixture.componentInstance.visible()).toBe(true);
    expect(pressed()).toEqual(['Проведено']);
    expect(bodyText()).toContain('Проведено');
  });

  it('offers to take the toggle back and shows the lesson as it was', async () => {
    const undoable = vi.spyOn(TestBed.inject(Snackbar), 'undoable');
    await open(scheduledLesson(), PAST);

    toggle('Пропуск').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/outcome')
      .flush(scheduledLesson({ status: 'MISSED' }));
    expect(undoable).toHaveBeenCalledWith('Отмечено: пропуск', expect.any(Function));

    undoable.mock.calls[0]?.[1]();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/l-1/outcome' })
      .flush(scheduledLesson());
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(changed.map((lesson) => lesson.status)).toEqual(['MISSED', 'SCHEDULED']);
    expect(pressed()).toEqual([]);
  });

  it('switches the outcome and takes it off by pressing the chosen one again', async () => {
    await open(scheduledLesson({ status: 'CONDUCTED' }), PAST);

    toggle('Пропуск').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/outcome')
      .flush(scheduledLesson({ status: 'MISSED' }));
    await fixture.whenStable();
    toggle('Пропуск').click();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/l-1/outcome' })
      .flush(scheduledLesson());
    await fixture.whenStable();

    expect(changed.map((lesson) => lesson.status)).toEqual(['MISSED', 'SCHEDULED']);
    expect(pressed()).toEqual([]);
  });

  it('puts the toggle back when the outcome did not save', async () => {
    await open(scheduledLesson({ status: 'MISSED' }), PAST);

    toggle('Проведено').click();
    await fixture.whenStable();
    expect(pressed()).toEqual(['Проведено']);
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/outcome')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(pressed()).toEqual(['Пропуск']);
    expect(changed).toHaveLength(0);
  });

  it('puts the toggle back when the lesson is gone before it is saved', async () => {
    await open(scheduledLesson(), PAST);
    fixture.componentRef.setInput('lesson', null);
    await fixture.whenStable();

    fixture.componentInstance.mark({ outcome: 'MISSED', revert: () => undefined });

    backend.expectNone((request) => request.url.endsWith('/outcome'));
  });

  it('withdraws the mark of a group lesson from the menu', async () => {
    await open(groupLesson({ status: 'CONDUCTED' }), PAST);

    await choose('Снять отметку');
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/gl-1/outcome' })
      .flush(groupLesson());
    await fixture.whenStable();

    expect(changed.map((lesson) => lesson.status)).toEqual(['SCHEDULED']);
  });

  it('has no «Снять отметку» for a lesson with one student: the toggle does it', async () => {
    await open(scheduledLesson(), PAST);

    buttonByText(document.body, 'Другие действия').click();
    await fixture.whenStable();

    expect(() => menuItemByText('Снять отметку')).toThrow();
    expect(menuItemByText('Удалить…')).toBeTruthy();
  });

  it('opens the attendance of a past group lesson in place of the card', async () => {
    await open(groupLesson(), PAST);
    expect(bodyText()).toContain('Участники');
    expect(bodyText()).not.toContain('Проведено');

    buttonByText(document.body, 'Отметить посещаемость').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.visible()).toBe(false);
    expect(bodyText()).toContain('Кто был на занятии');
    fixture.debugElement
      .query(By.directive(AttendanceDialog))
      .injector.get(AttendanceDialog)
      .saved.emit(groupLesson({ status: 'CONDUCTED' }));
    expect(changed.map((lesson) => lesson.status)).toEqual(['CONDUCTED']);
  });

  it('has no footer for a group lesson that has not started', async () => {
    await open(groupLesson());

    expect(() => buttonByText(document.body, 'Отметить посещаемость')).toThrow();
  });

  it('hands cancelling over to its own dialog once the card is closed', async () => {
    await open(scheduledLesson());

    await choose('Отменить занятие…');

    expect(fixture.componentInstance.visible()).toBe(false);
    const cancel = fixture.debugElement
      .query(By.directive(LessonCancelDialog))
      .injector.get(LessonCancelDialog);
    expect(cancel.visible()).toBe(true);
    cancel.cancelled.emit(scheduledLesson({ status: 'CANCELLED' }));
    expect(changed.map((lesson) => lesson.status)).toEqual(['CANCELLED']);
  });

  it('offers cancelling only for a planned lesson', async () => {
    await open(scheduledLesson({ status: 'CANCELLED' }), PAST);

    buttonByText(document.body, 'Другие действия').click();
    await fixture.whenStable();

    expect(() => menuItemByText('Отменить занятие')).toThrow();
  });

  it('deletes a single lesson after a confirmation', async () => {
    const asked = expectConfirmation();
    await open(scheduledLesson());

    await choose('Удалить…');

    expect(fixture.componentInstance.visible()).toBe(false);
    expect(asked().message).toContain('Ученику придёт уведомление, что занятие отменено');
    asked().accept?.();
    await fixture.whenStable();
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/schedule/lessons/l-1?version=0' })
      .flush(null);
    await fixture.whenStable();

    expect(deleted).toEqual(['l-1']);
  });

  it('does not delete when the confirmation is declined', async () => {
    const asked = expectConfirmation();
    await open(scheduledLesson({ status: 'CANCELLED' }), PAST);

    await choose('Удалить…');
    expect(asked().message).not.toContain('Ученику придёт уведомление');
    asked().reject?.();
    await fixture.whenStable();

    backend.expectNone((request) => request.method === 'DELETE');
    expect(deleted).toEqual([]);
  });

  it('asks which lessons of a series to delete in a dialog of its own', async () => {
    await open(scheduledLesson({ seriesId: 'rule-1', repeatWeeks: 2 }));

    await choose('Удалить…');

    expect(fixture.componentInstance.visible()).toBe(false);
    const dialog = fixture.debugElement
      .query(By.directive(LessonDeleteDialog))
      .injector.get(LessonDeleteDialog);
    expect(dialog.visible()).toBe(true);
    dialog.deleted.emit('l-1');
    expect(deleted).toEqual(['l-1']);
  });

  it('offers no deleting of a lesson that was charged', async () => {
    await open(
      scheduledLesson({
        status: 'MISSED',
        participants: [
          {
            studentId: 's-1',
            studentName: 'Иван Петров',
            studentAvatar: null,
            attendance: 'MISSED',
          },
        ],
      }),
      PAST,
    );

    expect(() => buttonByText(document.body, 'Другие действия')).toThrow();
  });

  it('keeps the dangerous actions in the menu: the footer holds the one of the state only', async () => {
    await open(scheduledLesson());

    buttonByText(document.body, 'Другие действия').click();
    await fixture.whenStable();

    expect(menuItemByText('Удалить…').closest('li')?.className).toContain('tb-menu-item--danger');
    expect(document.body.querySelectorAll('.p-dialog-footer .p-button-danger')).toHaveLength(0);
  });

  it('restores a cancelled lesson', async () => {
    await open(scheduledLesson({ status: 'CANCELLED', cancelReason: 'Болезнь' }), PAST);
    expect(bodyText()).toContain('Причина отмены: Болезнь');

    buttonByText(document.body, 'Восстановить').click();
    const request = backend.expectOne('/api/teacher/schedule/lessons/l-1/restore');
    expect(request.request.body).toMatchObject({ allowOverlap: false });
    request.flush(scheduledLesson());
    await fixture.whenStable();

    expect(changed).toHaveLength(1);
    expect(fixture.componentInstance.visible()).toBe(false);
  });

  it('asks before restoring a lesson over another one, and restores on a yes', async () => {
    const asked = expectConfirmation();
    await open(scheduledLesson({ status: 'CANCELLED' }), PAST);

    buttonByText(document.body, 'Восстановить').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/restore')
      .flush({ status: 409, code: 'schedule.overlap' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(asked().message).toContain('Всё равно восстановить?');
    asked().accept?.();
    await fixture.whenStable();
    const again = backend.expectOne('/api/teacher/schedule/lessons/l-1/restore');
    expect(again.request.body).toMatchObject({ allowOverlap: true });
    again.flush(scheduledLesson());
    expect(changed).toHaveLength(1);
  });

  it('leaves the lesson cancelled when the overlap is not accepted', async () => {
    const asked = expectConfirmation();
    await open(scheduledLesson({ status: 'CANCELLED' }), PAST);

    buttonByText(document.body, 'Восстановить').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/restore')
      .flush({ status: 409, code: 'schedule.overlap' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    asked().reject?.();
    await fixture.whenStable();

    backend.expectNone('/api/teacher/schedule/lessons/l-1/restore');
    expect(changed).toHaveLength(0);
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('tells in a snackbar when a lesson could not be restored', async () => {
    const snackbar = vi.spyOn(TestBed.inject(Snackbar), 'error');
    await open(scheduledLesson({ status: 'CANCELLED' }), PAST);

    buttonByText(document.body, 'Восстановить').click();
    backend
      .expectOne('/api/teacher/schedule/lessons/l-1/restore')
      .flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(snackbar).toHaveBeenCalledWith(expect.stringContaining('Не удалось'));
    expect(changed).toHaveLength(0);
    expect(fixture.componentInstance.visible()).toBe(true);
  });

  it('shows the students of a group lesson with the name of the group', async () => {
    await open(groupLesson({ startsAt: at(2026, 9, 29, 18), endsAt: at(2026, 9, 29, 19, 30) }));

    const text = bodyText();
    expect(document.body.querySelector('.p-dialog-title')?.textContent).toContain('Группа «ОГЭ»');
    expect(text).toContain('Мария');
    expect(text).toContain('Предупредил');
  });

  it('shows «Итоги» of a lesson, but not of a cancelled one', async () => {
    await open(scheduledLesson());
    expect(bodyText()).toContain('Что прошли');

    await open(scheduledLesson({ status: 'CANCELLED', cancelledBy: 'TEACHER' }));
    expect(bodyText()).not.toContain('Что прошли');
  });

  it('keeps the lesson a summary save returned and tells the page', async () => {
    await open(scheduledLesson());
    const area = requireElement(document.body, 'textarea[id^="summary-"]', HTMLTextAreaElement);
    typeInto(area, 'Итоги');
    area.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    const updated = scheduledLesson({ summary: 'Итоги' });
    backend.expectOne('/api/teacher/schedule/lessons/l-1/summary').flush(updated);
    await fixture.whenStable();

    expect(changed).toEqual([updated]);
  });
});
