import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toIsoDate } from '@shared/dates/iso-date';
import { AssistChip } from '@shared/ui/assist-chip';
import { ScheduleApi } from '../data-access/schedule-api';
import { T } from '../i18n/texts';
import { toTime } from '../teacher/lesson-time';

/** The step of the starts the backend offers (`TeacherAvailability.FREE_TIME_STEP`). */
const STEP_MS = 15 * 60_000;

/** A run of free starts: a lesson can begin from `start` to `lastStart` and ends by `end` at the latest. */
interface Window {
  readonly start: Date;
  readonly lastStart: Date;
  readonly end: Date;
}

/**
 * The free windows of a day to move a lesson to («9:00–11:30»): consecutive free starts collapsed
 * into ranges; a window puts its start into the time field, which stays the main control. With
 * `selected` a short hint says when the typed time fits no window.
 */
@Component({
  selector: 'tb-free-times',
  imports: [AssistChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (windows().length > 0) {
      <div class="tb-free-times" role="group" [attr.aria-label]="t.label">
        <span class="tb-free-times__label">{{ t.label }}:</span>
        @for (window of windows(); track window.start.getTime()) {
          <tb-assist-chip (click)="picked.emit(window.start)">{{ label(window) }}</tb-assist-chip>
        }
      </div>
    }
    @if (taken()) {
      <small class="tb-field__error" role="status">{{ t.taken }}</small>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin-block-start: var(--tb-space-2);
    }

    :host:empty {
      display: none;
    }

    .tb-free-times {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-free-times__label {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
    }
  `,
})
export class FreeTimes {
  protected readonly t = T.freeTimes;
  private readonly api = inject(ScheduleApi);

  readonly lessonId = input.required<string>();
  readonly date = input.required<Date>();
  /** The lesson's length: a window ends that long after its last start; `null` until known. */
  readonly minutes = input<number | null>(null);
  /** The teacher's endpoint (any lesson) or the student's (own lessons). */
  readonly asTeacher = input(false);
  /** The time typed in the field: when it fits no window the hint appears. */
  readonly selected = input<Date | null>(null);
  readonly picked = output<Date>();

  /** `null` until the day is loaded. */
  private readonly starts = signal<Date[] | null>(null);

  protected readonly windows = computed<Window[]>(() => {
    const minutes = this.minutes();
    const windows: { start: Date; lastStart: Date }[] = [];
    for (const start of this.starts() ?? []) {
      const last = windows.at(-1);
      if (last && start.getTime() - last.lastStart.getTime() <= STEP_MS) {
        last.lastStart = start;
      } else {
        windows.push({ start, lastStart: start });
      }
    }
    return minutes === null
      ? []
      : windows.map((w) => ({ ...w, end: new Date(w.lastStart.getTime() + minutes * 60_000) }));
  });

  /** A future time typed in the field that no window covers. */
  protected readonly taken = computed(() => {
    const selected = this.selected();
    const starts = this.starts();
    return (
      selected !== null &&
      starts !== null &&
      selected.getTime() > Date.now() &&
      !this.windows().some((w) => selected >= w.start && selected <= w.lastStart)
    );
  });

  constructor() {
    effect((onCleanup) => {
      const day = toIsoDate(this.date());
      const subscription = this.api.freeTimes(this.lessonId(), day, this.asTeacher()).subscribe({
        next: (times) => {
          this.starts.set(times.map((time) => new Date(time)));
        },
        error: () => {
          this.starts.set(null);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  protected label(window: Window): string {
    return `${toTime(window.start)}–${toTime(window.end)}`;
  }
}
