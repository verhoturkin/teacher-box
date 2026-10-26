import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import {
  ButtonGroupInfo,
  ButtonInfo,
  CalendarOptions,
  DateSelectInfo,
  DatesSetInfo,
  EventClickInfo,
  EventDisplayInfo,
  EventDropInfo,
  EventInput,
  FullCalendarComponent,
  FullCalendarModule,
} from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import listPlugin from '@fullcalendar/angular/list';
import classicTheme from '@fullcalendar/angular/themes/classic';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import enGbLocale from 'fullcalendar/locales/en-gb';
import ruLocale from 'fullcalendar/locales/ru';
import { injectMobile } from '@core/layout/mobile';
import { labelKey } from '@core/theme/label-colors';
import { TeacherColors } from '@features/identity/parts';
import { toIsoDate } from '@shared/dates/iso-date';
import { BusyTime, OffTimePeriod, ScheduledLesson } from '../data-access/schedule.models';
import { Language, language } from '@core/i18n/language';
import { T } from '../i18n/texts';

/** Days `[from, to)` shown by the calendar (`yyyy-MM-dd`, browser time zone). */
export interface CalendarRange {
  readonly from: string;
  readonly to: string;
  /** The day the view is on (`yyyy-MM-dd`): the first day of the week or the month. */
  readonly current: string;
}

/** A lesson moved to another time and confirmed; `revert` puts it back if the change is not saved. */
export interface LessonMove {
  readonly lesson: ScheduledLesson;
  readonly startsAt: Date;
  readonly revert: () => void;
}

const C = T.calendar;

/** FullCalendar's texts and week of each language of the interface (ADR-0035). */
const CALENDAR_LOCALES: Readonly<Record<Language, typeof ruLocale>> = {
  ru: ruLocale,
  en: enGbLocale,
};

/** An empty time range the teacher selected to plan a lesson; `allDay` — whole days of the month view. */
export interface SlotSelection {
  readonly start: Date;
  readonly end: Date;
  readonly allDay?: boolean;
}

/** A dropped lesson waiting on its card for «Перенести» or «Отменить перенос»; `saving` — confirmed. */
interface PendingMove {
  readonly lesson: ScheduledLesson;
  readonly startsAt: Date;
  readonly saving: boolean;
}

export type CalendarView = 'timeGridWeek' | 'dayGridMonth' | 'listWeek' | 'timeGridDay';

/**
 * Lessons in a week / month / list calendar (FullCalendar, MIT). In the editable mode (the teacher)
 * empty time can be selected and planned lessons dragged to another time: a dropped lesson stays at the
 * new time with «Перенести» and «Отменить перенос» on its card and is saved only when confirmed. On a phone the lessons
 * are a list by days, the toolbar is split between the top and the bottom (ADR-0015).
 */
@Component({
  selector: 'tb-schedule-calendar',
  imports: [FullCalendarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<full-calendar #calendar [options]="options()" />`,
})
export class ScheduleCalendar {
  readonly lessons = input.required<readonly ScheduledLesson[]>();
  readonly editable = input(false);
  /** The teacher's calendar: titles show the student's name, lessons the colours of students and groups. */
  readonly showStudent = input(true);
  readonly initialView = input<CalendarView>('timeGridWeek');
  /** Day to show first (`yyyy-MM-dd`); today by default. */
  readonly initialDate = input<string | null>(null);
  /**
   * When the teacher is busy (their Google Calendar; for a student also other lessons): a grey
   * background in the week, day and month; the list shows lessons only.
   */
  readonly busy = input<readonly BusyTime[]>([]);
  /** Caption on the busy times (the student's calendar: «Занято»); none by default. */
  readonly busyTitle = input<string | null>(null);
  /** The teacher's off time (the teacher's calendar): hatched in the week, day and month. */
  readonly offTime = input<readonly OffTimePeriod[]>([]);
  /** Whether the lessons are loaded: until then an empty week is not «Занятий нет» (ADR-0025). */
  readonly loaded = input(true);
  /** A day to go to (`yyyy-MM-dd`), e.g. from the mini-month; the calendar moves when it changes. */
  readonly focusDate = input<string | null>(null);
  /** Past lessons without a mark (`GET /schedule/unmarked`): outlined in the grid, marked from the lesson's dialog. */
  readonly unmarked = input<readonly ScheduledLesson[]>([]);
  /**
   * A phone's own screen of the calendar (the teacher's «Неделя», «Месяц»): that view without the footer of
   * views, which the page’s screen chips replace. Without it a phone shows the list with the footer.
   */
  readonly phoneView = input<CalendarView | null>(null);

  readonly rangeChange = output<CalendarRange>();
  readonly lessonClick = output<ScheduledLesson>();
  readonly slotSelect = output<SlotSelection>();
  readonly lessonMove = output<LessonMove>();

  private readonly calendar = viewChild(FullCalendarComponent);
  private readonly mobile = injectMobile();
  private readonly colors = inject(TeacherColors);

  /** The dropped lesson waiting for confirmation; new lessons (a reload after saving) drop it. */
  private readonly pending = linkedSignal<readonly ScheduledLesson[], PendingMove | null>({
    source: this.lessons,
    computation: () => null,
  });

  constructor() {
    effect(() => {
      const date = this.focusDate();
      if (date !== null) {
        this.calendar()?.getApi().gotoDate(date);
      }
    });
  }

  private readonly unmarkedIds = computed(
    () => new Set(this.unmarked().map((lesson) => lesson.id)),
  );

  private readonly byId = computed(
    () => new Map(this.lessons().map((lesson) => [lesson.id, lesson])),
  );

  protected readonly options = computed<CalendarOptions>(() => {
    const editable = this.editable();
    const mobile = this.mobile();
    const phoneView = this.phoneView();
    return {
      plugins: [classicTheme, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      locale: CALENDAR_LOCALES[language()],
      initialView: mobile ? (phoneView ?? 'listWeek') : this.initialView(),
      initialDate: this.initialDate() ?? undefined,
      ...(mobile
        ? {
            headerToolbar: { start: 'title', end: 'prev,next' },
            toolbarTitleClass: 'tb-calendar-title',
            footerToolbar:
              phoneView === null
                ? { start: 'today', end: 'listWeek,timeGridDay,dayGridMonth' }
                : { start: 'today' },
          }
        : {
            headerToolbar: {
              start: 'prev,next today',
              center: 'title',
              end: 'timeGridWeek,dayGridMonth,listWeek',
            },
            // Explicitly: after a rotation from the phone the footer would otherwise stay
            footerToolbar: false,
          }),
      // M3 buttons and segmented buttons (styles.scss)
      buttonClass: (button: ButtonInfo) =>
        button.buttonGroup?.hasSelection === true ? 'tb-fc-segment' : 'tb-fc-button',
      buttonGroupClass: (group: ButtonGroupInfo) => (group.hasSelection ? 'tb-fc-segments' : ''),
      // the grid, the day header, the cards and the month cells (styles.scss, «Calendar»)
      viewClass: 'tb-cal-view',
      slotHeaderClass: 'tb-cal-slot-header',
      slotHeaderInnerClass: 'tb-cal-slot-label',
      slotLaneClass: 'tb-cal-slot-lane',
      dayHeaderClass: 'tb-cal-day-header',
      dayHeaderInnerClass: (info) => (info.isToday ? 'tb-cal-day tb-cal-day--today' : 'tb-cal-day'),
      dayCellTopInnerClass: (info) =>
        info.isToday ? 'tb-cal-date tb-cal-date--today' : 'tb-cal-date',
      blockEventClass: 'tb-cal-card',
      rowEventClass: 'tb-cal-pill',
      moreLinkClass: 'tb-cal-more',
      views: {
        timeGrid: {
          dayHeaderContent: (info) => dayHeaderNodes(info.date, info.text),
          nowIndicatorLineClass: 'tb-cal-now-line',
          nowIndicatorHeaderClass: 'tb-cal-now-dot',
        },
      },
      listText: C.list,
      // hints for screen readers in the language of the interface (ADR-0024, ADR-0035)
      eventsHint: C.events,
      timedText: C.timed,
      closeHint: C.close,
      prevHint: C.previous,
      nextHint: C.next,
      todayHint: C.today,
      viewHint: C.view,
      navLinkHint: C.open,
      moreLinkHint: C.more,
      noEventsText: this.loaded() ? C.noLessons : C.loading,
      // styled as the compact empty state of the widgets (styles.scss, ADR-0018)
      noEventsClass: 'tb-calendar-empty',
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
      eventContent: (info: EventDisplayInfo) => this.content(info),
      events: [
        ...this.lessons().map((lesson) => this.toEvent(lesson, editable)),
        ...this.busy().map((busy, index) => this.toBusy(busy, index)),
        ...this.offTime().map((period, index) => toOffTime(period, index)),
      ],
      datesSet: (info: DatesSetInfo) => {
        this.rangeChange.emit({
          from: toIsoDate(info.start),
          to: toIsoDate(info.end),
          current: toIsoDate(info.view.currentStart),
        });
      },
      eventClick: (info: EventClickInfo) => {
        this.handleClick(info.event.id);
      },
      select: (info: DateSelectInfo) => {
        this.slotSelect.emit({ start: info.start, end: info.end, allDay: info.allDay });
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

  /** A dropped event waits on its card for confirmation; anything unknown is put back. */
  handleDrop(eventId: string, start: Date | null, revert: () => void): void {
    const lesson = this.byId().get(eventId);
    if (lesson === undefined || start === null) {
      revert();
      return;
    }
    this.pending.set({ lesson, startsAt: start, saving: false });
  }

  /** «Перенести»: the move goes to the page; the lesson stays at the new time while it is saved. */
  confirmMove(): void {
    const pending = this.pending();
    if (pending === null || pending.saving) {
      return;
    }
    this.pending.set({ ...pending, saving: true });
    this.lessonMove.emit({
      lesson: pending.lesson,
      startsAt: pending.startsAt,
      revert: () => {
        this.pending.set(null);
      },
    });
  }

  /** «Отменить перенос»: the lesson goes back to its time. */
  cancelMove(): void {
    this.pending.set(null);
  }

  private toEvent(lesson: ScheduledLesson, editable: boolean): EventInput {
    const pending = this.pending();
    const moved = pending?.lesson.id === lesson.id ? pending : null;
    const classes = lessonClasses(lesson);
    // the colour of the student or the group: the teacher's calendar only, a student never sees it
    const color = this.showStudent() ? this.colors.owner(lesson.studentId, lesson.groupId) : null;
    if (color !== null) {
      classes.push('tb-label', `tb-label--${labelKey(color)}`);
    }
    if (this.unmarkedIds().has(lesson.id)) {
      classes.push('tb-lesson--unmarked');
    }
    if (moved !== null) {
      classes.push('tb-lesson--moving');
    }
    return {
      id: lesson.id,
      title: this.title(lesson),
      ...(moved === null
        ? { start: lesson.startsAt, end: lesson.endsAt }
        : {
            start: moved.startsAt,
            end: new Date(moved.startsAt.getTime() + lesson.durationMinutes * 60_000),
          }),
      editable: editable && lesson.status === 'SCHEDULED' && moved?.saving !== true,
      className: classes.join(' '),
    };
  }

  /** The default content; the dropped lesson also gets «Перенести» and «Отменить перенос». */
  private content(info: EventDisplayInfo): { domNodes: Node[] } | true {
    const pending = this.pending();
    if (pending?.lesson.id !== info.event.id || pending.saving || info.isMirror) {
      return true;
    }
    const time = textNode(info.timeClass, info.timeText);
    const title = textNode(info.titleClass, info.event.title);
    const actions = document.createElement('div');
    actions.className = 'tb-lesson-move';
    actions.append(
      moveButton('tb-i tb-i-check', C.move, () => {
        this.confirmMove();
      }),
      moveButton('tb-i tb-i-close', C.undoMove, () => {
        this.cancelMove();
      }),
    );
    return { domNodes: [time, title, actions] };
  }

  private toBusy(busy: BusyTime, index: number): EventInput {
    const title = this.busyTitle();
    return {
      id: `busy-${String(index)}`,
      start: busy.start,
      end: busy.end,
      display: 'background',
      className: 'tb-busy',
      ...(title === null ? {} : { title }),
    };
  }

  private title(lesson: ScheduledLesson): string {
    const request = lesson.pendingRequests.length === 0 ? '' : '? ';
    if (this.showStudent() || lesson.groupId !== null) {
      const name =
        lesson.groupId !== null ? (lesson.groupName ?? C.group) : (lesson.studentName ?? T.student);
      return request + (lesson.topic === null ? name : `${name} · ${lesson.topic}`);
    }
    return request + (lesson.topic ?? C.lesson);
  }
}

/** The week and day header as in Google Calendar: the weekday over a large day number. */
function dayHeaderNodes(date: Date, text: string): { domNodes: Node[] } {
  const weekday = new Intl.DateTimeFormat(language(), { weekday: 'short' }).format(date);
  // the day view's text already is the full date: keep it as the accessible name
  const node = textNode('tb-cal-day__weekday', weekday);
  node.title = text;
  return { domNodes: [node, textNode('tb-cal-day__number', String(date.getDate()))] };
}

function textNode(className: string, text: string): HTMLElement {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  return node;
}

/** An icon button on the card: it neither opens the lesson nor starts a drag. */
function moveButton(icon: string, label: string, action: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tb-lesson-move__button';
  button.title = label;
  button.setAttribute('aria-label', label);
  const glyph = document.createElement('i');
  glyph.className = icon;
  glyph.setAttribute('aria-hidden', 'true');
  button.append(glyph);
  for (const type of ['pointerdown', 'mousedown', 'touchstart']) {
    button.addEventListener(type, (event) => {
      event.stopPropagation();
    });
  }
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    action();
  });
  return button;
}

function toOffTime(period: OffTimePeriod, index: number): EventInput {
  return {
    id: `off-${String(index)}`,
    title: period.note ?? C.offTime,
    start: period.start,
    end: period.end,
    display: 'background',
    className: 'tb-off-time',
  };
}

/** CSS classes of a lesson event: its status, a group lesson and whether a request waits for an answer. */
export function lessonClasses(lesson: ScheduledLesson): string[] {
  const classes = ['tb-lesson', `tb-lesson--${lesson.status.toLowerCase()}`];
  if (lesson.groupId !== null) {
    classes.push('tb-lesson--group');
  }
  if (lesson.pendingRequests.length > 0) {
    classes.push('tb-lesson--request');
  }
  return classes;
}
