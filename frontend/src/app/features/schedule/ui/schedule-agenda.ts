import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { Button } from 'primeng/button';
import { TeacherColors } from '@features/identity/parts';
import { Avatar } from '@shared/ui/avatar';
import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import { LessonOutcome, ScheduledLesson } from '../data-access/schedule.models';
import { WEEKDAYS, formatLessonTime, lessonWith } from '../schedule-labels';
import { T } from '../i18n/texts';

/** The Monday of the week of a day (`yyyy-MM-dd`). */
export function weekStart(day: string): string {
  const date = fromIsoDate(day);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toIsoDate(date);
}

/** The seven days of the week that starts on `monday`. */
export function weekDays(monday: string): string[] {
  const first = fromIsoDate(monday);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return toIsoDate(date);
  });
}

/** A mark of a lesson from its row. */
export interface AgendaMark {
  readonly lesson: ScheduledLesson;
  readonly outcome: LessonOutcome;
}

/**
 * The schedule of a phone (spec §7): a week strip (a chip per day, a dot under a day with lessons) and the
 * lessons of the chosen day. A past lesson without a mark carries the `Проведено | Пропуск` group under its
 * row (a group lesson — «Отметить»). *Our decision:* when the chosen day has nothing to mark but other days do,
 * a tonal button goes to the earliest of them, so no lesson is lost without the old card.
 */
@Component({
  selector: 'tb-schedule-agenda',
  imports: [Avatar, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-agenda__strip" role="group" [attr.aria-label]="t.weekStrip">
      <p-button
        icon="tb-i tb-i-chevron_left"
        severity="secondary"
        [text]="true"
        [rounded]="true"
        [ariaLabel]="t.prevWeek"
        (onClick)="shiftWeek(-7)"
      />
      @for (chip of chips(); track chip.iso) {
        <button
          type="button"
          class="tb-agenda__day"
          [class.tb-agenda__day--today]="chip.today"
          [attr.aria-pressed]="chip.selected"
          [attr.aria-label]="chip.label"
          (click)="day.set(chip.iso)"
        >
          <span class="tb-agenda__weekday">{{ chip.weekday }}</span>
          <span class="tb-agenda__date">{{ chip.date }}</span>
          <span class="tb-agenda__dot" [class.tb-agenda__dot--on]="chip.marked"></span>
        </button>
      }
      <p-button
        icon="tb-i tb-i-chevron_right"
        severity="secondary"
        [text]="true"
        [rounded]="true"
        [ariaLabel]="t.nextWeek"
        (onClick)="shiftWeek(7)"
      />
    </div>

    @if (jumpTo(); as target) {
      <p-button
        class="tb-agenda__jump"
        icon="tb-i tb-i-event_busy"
        severity="secondary"
        [label]="t.unmarkedJump(unmarked().length)"
        [fluid]="true"
        (onClick)="day.set(target)"
      />
    }

    @if (dayLessons().length === 0) {
      <p class="tb-muted tb-agenda__empty">{{ loaded() ? t.noLessonsDay : '' }}</p>
    } @else {
      <ul class="tb-agenda__list">
        @for (lesson of dayLessons(); track lesson.id) {
          <li class="tb-agenda__item">
            <button
              type="button"
              class="tb-agenda__row"
              [class.tb-agenda__row--cancelled]="lesson.status === 'CANCELLED'"
              (click)="lessonClick.emit(lesson)"
            >
              @if (showStudent()) {
                <tb-avatar
                  [attr.data-tb-label]="colors.ownerLabel(lesson.studentId, lesson.groupId)"
                  [name]="with(lesson)"
                  [photo]="lesson.studentAvatar"
                />
              } @else {
                <span class="tb-list__lead" aria-hidden="true"
                  ><i class="tb-i tb-i-calendar_month"></i
                ></span>
              }
              <span class="tb-agenda__text">
                <span class="tb-agenda__title">{{
                  showStudent() ? with(lesson) : (lesson.topic ?? t.lesson)
                }}</span>
                <span class="tb-agenda__supporting">{{ time(lesson) }}</span>
              </span>
            </button>
            @if (isUnmarked(lesson)) {
              <div class="tb-agenda__marks tb-button-group">
                @if (lesson.groupId !== null) {
                  <p-button
                    [label]="t.mark"
                    icon="tb-i tb-i-group"
                    [fluid]="true"
                    [ariaLabel]="t.markAttendance(with(lesson))"
                    (onClick)="markAttendance.emit(lesson)"
                  />
                } @else {
                  <p-button
                    [label]="t.conductedLabel"
                    icon="tb-i tb-i-check"
                    [ariaLabel]="t.conducted(lesson.studentName ?? t.student)"
                    [loading]="marking()(lesson.id)"
                    (onClick)="mark.emit({ lesson, outcome: 'CONDUCTED' })"
                  />
                  <p-button
                    [label]="t.missedLabel"
                    icon="tb-i tb-i-person_remove"
                    severity="secondary"
                    [ariaLabel]="t.missed(lesson.studentName ?? t.student)"
                    [loading]="marking()(lesson.id)"
                    (onClick)="mark.emit({ lesson, outcome: 'MISSED' })"
                  />
                }
              </div>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }

    .tb-agenda__strip {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
    }

    /* a day chip: 48 dp wide touch target, the chosen one is filled (our decision: M3 has no week strip) */
    .tb-agenda__day {
      display: flex;
      flex: 1;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      min-inline-size: 0;
      padding: var(--tb-space-2) 0;
      border: 0;
      border-radius: var(--tb-shape-lg);
      background: transparent;
      color: var(--p-md-on-surface);
      cursor: pointer;
    }

    .tb-agenda__day[aria-pressed='true'] {
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);
    }

    .tb-agenda__day--today:not([aria-pressed='true']) .tb-agenda__date {
      color: var(--p-md-primary);
      font-weight: 700;
    }

    .tb-agenda__weekday {
      font: var(--tb-type-label-m);
    }

    .tb-agenda__date {
      font: var(--tb-type-title-m);
    }

    .tb-agenda__dot {
      inline-size: 6px;
      block-size: 6px;
      border-radius: var(--tb-shape-full);
    }

    .tb-agenda__dot--on {
      background: currentColor;
    }

    .tb-agenda__list {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-agenda__item {
      border-radius: var(--tb-shape-md);
      background: var(--p-md-surface-container-low);
      overflow: hidden;
    }

    .tb-agenda__row {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      inline-size: 100%;
      padding: var(--tb-space-3) var(--tb-space-4);
      border: 0;
      background: transparent;
      color: inherit;
      text-align: start;
      cursor: pointer;
    }

    .tb-agenda__row--cancelled {
      opacity: 0.6;
      text-decoration: line-through;
    }

    .tb-agenda__text {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }

    .tb-agenda__title {
      font: var(--tb-type-title-m);
      overflow-wrap: anywhere;
    }

    .tb-agenda__supporting {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    /* the group under its row: across the width, the buttons share it */
    .tb-agenda__marks {
      display: flex;
      padding: 0 var(--tb-space-4) var(--tb-space-3);

      > p-button {
        flex: 1;
      }
    }

    .tb-agenda__empty {
      margin: var(--tb-space-4) 0;
      text-align: center;
    }
  `,
})
export class ScheduleAgenda {
  /** The lessons of the loaded week. */
  readonly lessons = input.required<readonly ScheduledLesson[]>();
  /** In the student cabinet the topic replaces their own name. */
  readonly showStudent = input(true);
  /** Past lessons without a mark (`GET /schedule/unmarked`). */
  readonly unmarked = input<readonly ScheduledLesson[]>([]);
  readonly loaded = input(true);
  /** Whether the mark of a lesson is on its way. */
  readonly marking = input<(id: string) => boolean>(() => false);
  /** The chosen day (`yyyy-MM-dd`); its week is the strip. */
  readonly day = model.required<string>();

  readonly lessonClick = output<ScheduledLesson>();
  readonly mark = output<AgendaMark>();
  readonly markAttendance = output<ScheduledLesson>();

  protected readonly t = T.page;
  protected readonly colors = inject(TeacherColors);
  protected readonly with = lessonWith;

  private readonly unmarkedIds = computed(
    () => new Set(this.unmarked().map((lesson) => lesson.id)),
  );
  private readonly today = toIsoDate(new Date());
  private readonly daysWithLessons = computed(
    () => new Set(this.lessons().map((lesson) => toIsoDate(new Date(lesson.startsAt)))),
  );

  protected readonly chips = computed(() =>
    weekDays(weekStart(this.day())).map((iso, index) => {
      const date = fromIsoDate(iso);
      return {
        iso,
        weekday: WEEKDAYS[index]?.short ?? '',
        date: date.getDate(),
        label: date.toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }),
        today: iso === this.today,
        selected: iso === this.day(),
        marked: this.daysWithLessons().has(iso),
      };
    }),
  );

  protected readonly dayLessons = computed(() =>
    this.lessons()
      .filter((lesson) => toIsoDate(new Date(lesson.startsAt)) === this.day())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  );

  /** The earliest day with a lesson to mark, when the chosen day has none. */
  protected readonly jumpTo = computed(() => {
    const days = this.unmarked().map((lesson) => toIsoDate(new Date(lesson.startsAt)));
    if (days.length === 0 || days.includes(this.day())) {
      return null;
    }
    return days.reduce((first, next) => (next < first ? next : first));
  });

  protected isUnmarked(lesson: ScheduledLesson): boolean {
    return this.unmarkedIds().has(lesson.id);
  }

  protected time(lesson: ScheduledLesson): string {
    return formatLessonTime(lesson.startsAt, lesson.endsAt);
  }

  protected shiftWeek(days: number): void {
    const date = fromIsoDate(this.day());
    date.setDate(date.getDate() + days);
    this.day.set(toIsoDate(date));
  }
}
