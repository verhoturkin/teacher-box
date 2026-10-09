import { ComponentFixture, TestBed } from '@angular/core/testing';
import { changeRequest, groupLesson, scheduledLesson } from '@testing/schedule-fixtures';
import { hostElement, readableText, requireElement } from '@testing/dom';
import { ScheduledLesson } from '../data-access/schedule.models';
import { CalendarRange, LessonMove, ScheduleCalendar, lessonClasses } from './schedule-calendar';

describe('ScheduleCalendar', () => {
  let fixture: ComponentFixture<ScheduleCalendar>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ScheduleCalendar] });
    fixture = TestBed.createComponent(ScheduleCalendar);
    fixture.componentRef.setInput('initialView', 'listWeek');
    fixture.componentRef.setInput('initialDate', '2026-10-01');
  });

  async function render(lessons: ScheduledLesson[], showStudent = true): Promise<string> {
    fixture.componentRef.setInput('lessons', lessons);
    fixture.componentRef.setInput('showStudent', showStudent);
    fixture.detectChanges();
    await fixture.whenStable();
    return readableText(hostElement(fixture));
  }

  it('shows the teacher the students and reports the visible days', async () => {
    const ranges: CalendarRange[] = [];
    fixture.componentInstance.rangeChange.subscribe((range) => ranges.push(range));

    const text = await render([
      scheduledLesson({ topic: 'Дроби' }),
      scheduledLesson({ id: 'l-2', studentName: null, pendingRequests: [changeRequest()] }),
      groupLesson({ topic: 'Разбор' }),
      groupLesson({ id: 'gl-2', groupName: null }),
    ]);

    expect(ranges).toEqual([{ from: '2026-09-28', to: '2026-10-05' }]);
    expect(text).toContain('Иван Петров · Дроби');
    expect(text).toContain('? Ученик');
    expect(text).toContain('ОГЭ · Разбор');
    expect(text).toContain('Группа');
  });

  it('has M3 buttons: the views are a segmented button, the toolbar only on top', async () => {
    await render([]);
    const host = hostElement(fixture);

    const views = Array.from(host.querySelectorAll('.tb-fc-segments .tb-fc-segment'));
    expect(views.map((view) => view.textContent.trim())).toEqual(['Неделя', 'Месяц', 'Список']);
    const today = Array.from(host.querySelectorAll('.tb-fc-button')).filter(
      (button) => button.textContent.trim() === 'Сегодня',
    );
    expect(today).toHaveLength(1);
  });

  it('shows the student the topics', async () => {
    const text = await render(
      [scheduledLesson({ topic: 'Степени' }), scheduledLesson({ id: 'l-2' })],
      false,
    );

    expect(text).toContain('Степени');
    expect(text).toContain('Занятие');
    expect(text).not.toContain('Иван');
  });

  it('captions the busy times only when asked to', async () => {
    fixture.componentRef.setInput('initialView', 'timeGridWeek');
    fixture.componentRef.setInput('busy', [
      { start: '2026-10-01T09:00:00Z', end: '2026-10-01T10:00:00Z' },
    ]);
    const busy = (): Element[] => Array.from(hostElement(fixture).querySelectorAll('.tb-busy'));

    await render([]);
    expect(busy()).toHaveLength(1);
    expect(busy()[0]?.textContent.trim()).toBe('');

    fixture.componentRef.setInput('busyTitle', 'Занято');
    await render([]);
    expect(busy()[0]?.textContent.trim()).toBe('Занято');
  });

  it('hatches the teacher’s off time with its caption', async () => {
    fixture.componentRef.setInput('initialView', 'timeGridWeek');
    fixture.componentRef.setInput('offTime', [
      { offTimeId: 'o-1', start: '2026-10-01T09:00:00Z', end: '2026-10-01T10:00:00Z', note: null },
      {
        offTimeId: 'o-2',
        start: '2026-10-01T12:00:00Z',
        end: '2026-10-01T13:00:00Z',
        note: 'Обед',
      },
    ]);

    await render([]);
    const offTime = Array.from(hostElement(fixture).querySelectorAll('.tb-off-time')).map((event) =>
      event.textContent.trim(),
    );
    expect(offTime).toEqual(['Нерабочее время', 'Обед']);
  });

  it('opens a clicked lesson', async () => {
    const clicked: ScheduledLesson[] = [];
    fixture.componentInstance.lessonClick.subscribe((lesson) => clicked.push(lesson));
    await render([scheduledLesson()]);

    fixture.componentInstance.handleClick('l-1');
    fixture.componentInstance.handleClick('unknown');

    expect(clicked.map((lesson) => lesson.id)).toEqual(['l-1']);
  });

  it('puts back a drop it does not know', async () => {
    fixture.componentRef.setInput('editable', true);
    await render([scheduledLesson()]);
    const revert = vi.fn();

    fixture.componentInstance.handleDrop('l-1', null, revert);
    fixture.componentInstance.handleDrop('unknown', new Date(2026, 9, 2, 17), revert);

    expect(revert).toHaveBeenCalledTimes(2);
  });

  it('saves a dropped lesson only after «Перенести» on its card', async () => {
    const moves: LessonMove[] = [];
    fixture.componentInstance.lessonMove.subscribe((move) => moves.push(move));
    fixture.componentRef.setInput('editable', true);
    await render([scheduledLesson()]);
    const start = new Date(2026, 9, 2, 17);

    fixture.componentInstance.handleDrop('l-1', start, vi.fn());
    await fixture.whenStable();
    const host = hostElement(fixture);
    expect(moves).toEqual([]);
    expect(host.querySelector('.tb-lesson--moving')).not.toBeNull();
    const confirm = requireElement(host, 'button[aria-label="Перенести"]', HTMLButtonElement);
    expect(host.querySelector('button[aria-label="Отменить перенос"]')).not.toBeNull();

    confirm.click();
    await fixture.whenStable();
    expect(moves.map((move) => [move.lesson.id, move.startsAt])).toEqual([['l-1', start]]);
    // while it is saved the lesson stays at the new time without the buttons
    expect(host.querySelector('.tb-lesson--moving')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Перенести"]')).toBeNull();
    fixture.componentInstance.confirmMove();
    expect(moves).toHaveLength(1);

    // not saved: the lesson goes back
    moves[0]?.revert();
    await fixture.whenStable();
    expect(host.querySelector('.tb-lesson--moving')).toBeNull();
  });

  it('puts a dropped lesson back on «Отменить перенос»', async () => {
    const moves: LessonMove[] = [];
    fixture.componentInstance.lessonMove.subscribe((move) => moves.push(move));
    fixture.componentRef.setInput('editable', true);
    await render([scheduledLesson()]);

    fixture.componentInstance.handleDrop('l-1', new Date(2026, 9, 2, 17), vi.fn());
    await fixture.whenStable();
    const host = hostElement(fixture);
    requireElement(host, 'button[aria-label="Отменить перенос"]', HTMLButtonElement).click();
    await fixture.whenStable();

    expect(host.querySelector('.tb-lesson--moving')).toBeNull();
    expect(host.querySelector('button[aria-label="Перенести"]')).toBeNull();
    fixture.componentInstance.confirmMove();
    expect(moves).toEqual([]);
  });

  it('drops a waiting move when the lessons are loaded again', async () => {
    fixture.componentRef.setInput('editable', true);
    await render([scheduledLesson()]);

    fixture.componentInstance.handleDrop('l-1', new Date(2026, 9, 2, 17), vi.fn());
    await render([scheduledLesson()]);

    expect(hostElement(fixture).querySelector('.tb-lesson--moving')).toBeNull();
  });
});

describe('lessonClasses', () => {
  it('marks lessons by status and open requests', () => {
    expect(lessonClasses(scheduledLesson({ status: 'CANCELLED' }))).toEqual([
      'tb-lesson',
      'tb-lesson--cancelled',
    ]);
    expect(lessonClasses(groupLesson())).toEqual([
      'tb-lesson',
      'tb-lesson--scheduled',
      'tb-lesson--group',
    ]);
    expect(lessonClasses(scheduledLesson({ pendingRequests: [changeRequest()] }))).toEqual([
      'tb-lesson',
      'tb-lesson--scheduled',
      'tb-lesson--request',
    ]);
  });
});
