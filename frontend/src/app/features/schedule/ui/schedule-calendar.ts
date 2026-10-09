import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
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
  FullCalendarModule,
} from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/angular/daygrid';
import interactionPlugin from '@fullcalendar/angular/interaction';
import listPlugin from '@fullcalendar/angular/list';
import classicTheme from '@fullcalendar/angular/themes/classic';
import timeGridPlugin from '@fullcalendar/angular/timegrid';
import ruLocale from 'fullcalendar/locales/ru';
import { injectMobile } from '@core/layout/mobile';
import { toIsoDate } from '@shared/dates/iso-date';
import { BusyTime, OffTimePeriod, ScheduledLesson } from '../data-access/schedule.models';

/** Days `[from, to)` shown by the calendar (`yyyy-MM-dd`, browser time zone). */
export interface CalendarRange {
  readonly from: string;
  readonly to: string;
}

/** A lesson moved to another time and confirmed; `revert` puts it back if the change is not saved. */
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

  readonly rangeChange = output<CalendarRange>();
  readonly lessonClick = output<ScheduledLesson>();
  readonly slotSelect = output<SlotSelection>();
  readonly lessonMove = output<LessonMove>();

  private readonly mobile = injectMobile();

  /** The dropped lesson waiting for confirmation; new lessons (a reload after saving) drop it. */
  private readonly pending = linkedSignal<readonly ScheduledLesson[], PendingMove | null>({
    source: this.lessons,
    computation: () => null,
  });

  private readonly byId = computed(
    () => new Map(this.lessons().map((lesson) => [lesson.id, lesson])),
  );

  protected readonly options = computed<CalendarOptions>(() => {
    const editable = this.editable();
    const mobile = this.mobile();
    return {
      plugins: [classicTheme, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      locale: ruLocale,
      initialView: mobile ? 'listWeek' : this.initialView(),
      initialDate: this.initialDate() ?? undefined,
      ...(mobile
        ? {
            headerToolbar: { start: 'title', end: 'prev,next' },
            toolbarTitleClass: 'tb-calendar-title',
            footerToolbar: { start: 'today', end: 'listWeek,timeGridDay,dayGridMonth' },
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
      listText: 'Список',
      // hints for screen readers in Russian (ADR-0024)
      eventsHint: 'Занятия',
      timedText: 'Занятия по времени',
      closeHint: 'Закрыть',
      prevHint: 'Назад',
      nextHint: 'Вперёд',
      todayHint: 'Сегодня',
      viewHint: (text: string) => `Вид: ${text}`,
      navLinkHint: (dateText: string) => `Открыть ${dateText}`,
      moreLinkHint: (count: number) => `Ещё занятий: ${String(count)}`,
      noEventsText: this.loaded() ? 'Занятий нет' : 'Загрузка…',
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
      moveButton('pi pi-check', 'Перенести', () => {
        this.confirmMove();
      }),
      moveButton('pi pi-times', 'Отменить перенос', () => {
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
        lesson.groupId !== null ? (lesson.groupName ?? 'Группа') : (lesson.studentName ?? 'Ученик');
      return request + (lesson.topic === null ? name : `${name} · ${lesson.topic}`);
    }
    return request + (lesson.topic ?? 'Занятие');
  }
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
    title: period.note ?? 'Нерабочее время',
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
