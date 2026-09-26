import { ComponentFixture, TestBed } from '@angular/core/testing';
import { changeRequest, scheduledLesson } from '@testing/schedule-fixtures';
import { hostElement, readableText } from '@testing/dom';
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
      scheduledLesson({ id: 'l-2', studentName: null, pendingRequest: changeRequest() }),
    ]);

    expect(ranges).toEqual([{ from: '2026-09-28', to: '2026-10-05' }]);
    expect(text).toContain('Иван Петров · Дроби');
    expect(text).toContain('? Ученик');
  });

  it('shows the student the topics', async () => {
    const text = await render([scheduledLesson({ topic: 'Степени' }), scheduledLesson({ id: 'l-2' })], false);

    expect(text).toContain('Степени');
    expect(text).toContain('Занятие');
    expect(text).not.toContain('Иван');
  });

  it('opens a clicked lesson', async () => {
    const clicked: ScheduledLesson[] = [];
    fixture.componentInstance.lessonClick.subscribe((lesson) => clicked.push(lesson));
    await render([scheduledLesson()]);

    fixture.componentInstance.handleClick('l-1');
    fixture.componentInstance.handleClick('unknown');

    expect(clicked.map((lesson) => lesson.id)).toEqual(['l-1']);
  });

  it('turns a drop into a move or puts it back', async () => {
    const moves: LessonMove[] = [];
    fixture.componentInstance.lessonMove.subscribe((move) => moves.push(move));
    fixture.componentRef.setInput('editable', true);
    await render([scheduledLesson()]);
    const revert = vi.fn();
    const start = new Date(2026, 9, 2, 17);

    fixture.componentInstance.handleDrop('l-1', start, revert);
    fixture.componentInstance.handleDrop('l-1', null, revert);
    fixture.componentInstance.handleDrop('unknown', start, revert);

    expect(moves).toEqual([{ lesson: scheduledLesson(), startsAt: start, revert }]);
    expect(revert).toHaveBeenCalledTimes(2);
  });
});

describe('lessonClasses', () => {
  it('marks lessons by status and open requests', () => {
    expect(lessonClasses(scheduledLesson({ status: 'CANCELLED' }))).toEqual(['tb-lesson', 'tb-lesson--cancelled']);
    expect(lessonClasses(scheduledLesson({ pendingRequest: changeRequest() }))).toEqual([
      'tb-lesson',
      'tb-lesson--scheduled',
      'tb-lesson--request',
    ]);
  });
});
