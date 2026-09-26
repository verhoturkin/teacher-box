import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  CalendarOptions,
  DateSelectInfo,
  DatesSetInfo,
  EventClickInfo,
  EventDropInfo,
  EventInput,
  FullCalendarModule,
} from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import listPlugin from '@fullcalendar/angular/list';
import classicTheme from '@fullcalendar/angular/themes/classic';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import ruLocale from 'fullcalendar/locales/ru';
import { toIsoDate } from '@shared/dates/iso-date';
import { BusyTime, ScheduledLesson } from '../data-access/schedule.models';

/** Days `[from, to)` shown by the calendar (`yyyy-MM-dd`, browser time zone). */
export interface CalendarRange {
  readonly from: string;
  readonly to: string;
}

/** A lesson dragged to another time; `revert` puts it back if the change is not saved. */
export interface LessonMove {
  readonly lesson: ScheduledLesson;
  readonly startsAt: Date;
  readonly revert: () => void;
}

/** An empty time range the teacher selected to plan a lesson. */
export interface SlotSelection {
  readonly start: Date;
  readonly end: Date;
}

export type CalendarView = 'timeGridWeek' | 'dayGridMonth' | 'listWeek';

/**
 * Lessons in a week / month / list calendar (FullCalendar, MIT). In the editable mode (the teacher)
 * empty time can be selected and planned lessons dragged to another time.
 */
@Component({
  selector: 'tb-schedule-calendar',
  imports: [FullCalendarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<full-calendar [options]="options()" />`,
})
export class ScheduleCalendar {
  readonly lessons = input.required<readonly ScheduledLesson[]>();
  readonly editable = input(false);
  /** Titles show the student's name (the teacher's calendar). */
  readonly showStudent = input(true);
  readonly initialView = input<CalendarView>('timeGridWeek');
  /** Day to show first (`yyyy-MM-dd`); today by default. */
  readonly initialDate = input<string | null>(null);
  /** Busy times of the teacher's own calendars, shown in the background. */
  readonly busy = input<readonly BusyTime[]>([]);

  readonly rangeChange = output<CalendarRange>();
  readonly lessonClick = output<ScheduledLesson>();
  readonly slotSelect = output<SlotSelection>();
  readonly lessonMove = output<LessonMove>();

  private readonly byId = computed(() => new Map(this.lessons().map((lesson) => [lesson.id, lesson])));

  protected readonly options = computed<CalendarOptions>(() => {
    const editable = this.editable();
    return {
      plugins: [classicTheme, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      locale: ruLocale,
      initialView: this.initialView(),
      initialDate: this.initialDate() ?? undefined,
      headerToolbar: { start: 'prev,next today', center: 'title', end: 'timeGridWeek,dayGridMonth,listWeek' },
      firstDay: 1,
      nowIndicator: true,
      allDaySlot: false,
      slotMinTime: '07:00:00',
      slotMaxTime: '23:00:00',
      height: 'auto',
      selectable: editable,
      selectMirror: editable,
      editable,
      eventDurationEditable: false,
      events: [
        ...this.lessons().map((lesson) => this.toEvent(lesson, editable)),
        ...this.busy().map((busy, index) => ({
          id: `busy-${String(index)}`,
          start: busy.start,
          end: busy.end,
          display: 'background',
          className: 'tb-busy',
        })),
      ],
      datesSet: (info: DatesSetInfo) => {
        this.rangeChange.emit({ from: toIsoDate(info.start), to: toIsoDate(info.end) });
      },
      eventClick: (info: EventClickInfo) => {
        this.handleClick(info.event.id);
      },
      select: (info: DateSelectInfo) => {
        this.slotSelect.emit({ start: info.start, end: info.end });
      },
      eventDrop: (info: EventDropInfo) => {
        this.handleDrop(info.event.id, info.event.start, info.revert);
      },
    };
  });

  /** A click on an event opens its lesson. */
  handleClick(eventId: string): void {
    const lesson = this.byId().get(eventId);
    if (lesson !== undefined) {
      this.lessonClick.emit(lesson);
    }
  }

  /** A dropped event becomes a move of its lesson; anything unknown is put back. */
  handleDrop(eventId: string, start: Date | null, revert: () => void): void {
    const lesson = this.byId().get(eventId);
    if (lesson === undefined || start === null) {
      revert();
      return;
    }
    this.lessonMove.emit({ lesson, startsAt: start, revert });
  }

  private toEvent(lesson: ScheduledLesson, editable: boolean): EventInput {
    return {
      id: lesson.id,
      title: this.title(lesson),
      start: lesson.startsAt,
      end: lesson.endsAt,
      editable: editable && lesson.status === 'SCHEDULED',
      className: lessonClasses(lesson).join(' '),
    };
  }

  private title(lesson: ScheduledLesson): string {
    const request = lesson.pendingRequest === null ? '' : '? ';
    if (this.showStudent()) {
      const name = lesson.studentName ?? 'Ученик';
      return request + (lesson.topic === null ? name : `${name} · ${lesson.topic}`);
    }
    return request + (lesson.topic ?? 'Занятие');
  }
}

/** CSS classes of a lesson event: its status and whether a request waits for an answer. */
export function lessonClasses(lesson: ScheduledLesson): string[] {
  const classes = ['tb-lesson', `tb-lesson--${lesson.status.toLowerCase()}`];
  if (lesson.pendingRequest !== null) {
    classes.push('tb-lesson--request');
  }
  return classes;
}
