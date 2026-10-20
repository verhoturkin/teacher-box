import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { Button } from 'primeng/button';
import { locale } from '@core/i18n/language';
import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import { T } from '../i18n/texts';

/** One day of the grid. */
interface MiniDay {
  readonly iso: string;
  readonly day: number;
  readonly outside: boolean;
  readonly today: boolean;
  readonly marked: boolean;
  readonly current: boolean;
}

/**
 * A month for moving around the calendar (M3 date picker, docked): the weeks start on Monday, a dot under a
 * day with lessons, the day shown by the calendar is filled. *Our decision:* it is no input — a click on a day
 * only asks the calendar to go there (`dateSelect`).
 */
@Component({
  selector: 'tb-mini-month',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-mini-month__head">
      <span class="tb-mini-month__title" aria-live="polite">{{ title() }}</span>
      <p-button
        icon="tb-i tb-i-chevron_left"
        severity="secondary"
        [text]="true"
        [rounded]="true"
        [ariaLabel]="c.previous"
        (onClick)="shift(-1)"
      />
      <p-button
        icon="tb-i tb-i-chevron_right"
        severity="secondary"
        [text]="true"
        [rounded]="true"
        [ariaLabel]="c.next"
        (onClick)="shift(1)"
      />
    </div>
    <div class="tb-mini-month__grid">
      @for (name of weekdays(); track $index) {
        <span class="tb-mini-month__weekday" aria-hidden="true">{{ name }}</span>
      }
      @for (day of days(); track day.iso) {
        <button
          type="button"
          class="tb-mini-month__day"
          [class.tb-mini-month__day--outside]="day.outside"
          [class.tb-mini-month__day--today]="day.today"
          [class.tb-mini-month__day--current]="day.current"
          [class.tb-mini-month__day--marked]="day.marked"
          [attr.aria-current]="day.today ? 'date' : null"
          [attr.aria-pressed]="day.current"
          [attr.data-date]="day.iso"
          (click)="dateSelect.emit(day.iso)"
        >
          {{ day.day }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .tb-mini-month__head {
      display: flex;
      align-items: center;
      margin-block-end: var(--tb-space-2);
    }

    .tb-mini-month__title {
      flex: 1;
      font: var(--tb-type-title-s);
      text-transform: capitalize;
    }

    .tb-mini-month__grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      justify-items: center;
      row-gap: var(--tb-space-1);
    }

    .tb-mini-month__weekday {
      font: var(--tb-type-body-s);
      color: var(--p-md-on-surface-variant);
      text-transform: capitalize;
    }

    .tb-mini-month__day {
      position: relative;
      inline-size: 2.5rem;
      block-size: 2.5rem;
      border: 0;
      border-radius: var(--tb-shape-full);
      background: transparent;
      color: var(--p-md-on-surface);
      font: var(--tb-type-body-m);
      cursor: pointer;

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
      }
    }

    .tb-mini-month__day--outside {
      color: var(--p-md-on-surface-variant);
      opacity: 0.6;
    }

    .tb-mini-month__day--today {
      box-shadow: inset 0 0 0 1px var(--p-md-outline);
    }

    .tb-mini-month__day--current {
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);
      box-shadow: none;

      &:hover {
        background: var(--p-md-primary);
      }
    }

    .tb-mini-month__day--marked::after {
      content: '';
      position: absolute;
      inset-inline: 0;
      inset-block-end: 0.25rem;
      margin-inline: auto;
      inline-size: 0.25rem;
      block-size: 0.25rem;
      border-radius: var(--tb-shape-full);
      background: currentColor;
    }
  `,
})
export class MiniMonth {
  protected readonly c = T.calendar;
  /** The day the calendar shows (`yyyy-MM-dd`); the month follows it. */
  readonly current = input.required<string>();
  /** Days (`yyyy-MM-dd`) with lessons. */
  readonly marked = input<ReadonlySet<string>>(new Set());

  readonly dateSelect = output<string>();

  /** The first day of the shown month; follows the calendar, the arrows move it on their own. */
  private readonly month = linkedSignal(() => {
    const day = fromIsoDate(this.current());
    return new Date(day.getFullYear(), day.getMonth(), 1);
  });

  protected readonly title = computed(() =>
    this.month().toLocaleDateString(locale(), { month: 'long', year: 'numeric' }),
  );

  protected readonly weekdays = computed(() => {
    const monday = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, index) =>
      new Date(2024, 0, monday.getDate() + index).toLocaleDateString(locale(), {
        weekday: 'narrow',
      }),
    );
  });

  protected readonly days = computed<MiniDay[]>(() => {
    const first = this.month();
    const offset = (first.getDay() + 6) % 7;
    const today = toIsoDate(new Date());
    const current = this.current();
    const marked = this.marked();
    const weeks = Math.ceil(
      (offset + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7,
    );
    return Array.from({ length: weeks * 7 }, (_, index) => {
      const date = new Date(first.getFullYear(), first.getMonth(), index - offset + 1);
      const iso = toIsoDate(date);
      return {
        iso,
        day: date.getDate(),
        outside: date.getMonth() !== first.getMonth(),
        today: iso === today,
        marked: marked.has(iso),
        current: iso === current,
      };
    });
  });

  protected shift(by: number): void {
    const month = this.month();
    this.month.set(new Date(month.getFullYear(), month.getMonth() + by, 1));
  }
}
