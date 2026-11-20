import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { injectMedia } from '@core/layout/mobile';
import { toHhMm } from '@shared/dates/typed-time';
import { SHARED_T } from '@shared/i18n/texts';
import { DialogFooter, TbDialog } from './dialog/dialog';

export type TimeView = 'dial' | 'input';
type Unit = 'hour' | 'minute';

/** Ours: the radii of the outer (0–11, minutes) and inner (12–23) rings in the 256 dp dial, px. */
const OUTER = 101;
const INNER = 69;
const CENTRE = 128;

const ARROWS: Readonly<Record<string, number>> = {
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
};

/** The view chosen last: the picker opens in it for the rest of the session (ours, ADR-0067). */
let lastView: TimeView = 'dial';

/**
 * The value under a point of the dial, `x` and `y` from its centre (y down): an hour of the ring
 * the point is nearer to, or the minute snapped to the `step`.
 */
export function dialValue(x: number, y: number, unit: Unit, step: number): number {
  const degrees = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
  if (unit === 'hour') {
    const hour = Math.round(degrees / 30) % 12;
    return Math.hypot(x, y) < (OUTER + INNER) / 2 ? hour + 12 : hour;
  }
  return (Math.round(degrees / 6 / step) * step) % 60;
}

interface Mark {
  value: number;
  label: string;
  x: number;
  y: number;
}

function mark(value: number, label: string, index: number, radius: number): Mark {
  const angle = (index * Math.PI) / 6;
  return {
    value,
    label,
    x: CENTRE + radius * Math.sin(angle),
    y: CENTRE - radius * Math.cos(angle),
  };
}

const HOUR_MARKS = Array.from({ length: 24 }, (_, hour) =>
  mark(hour, hour === 0 ? '00' : String(hour), hour % 12, hour < 12 ? OUTER : INNER),
);
const MINUTE_MARKS = Array.from({ length: 12 }, (_, index) =>
  mark(index * 5, String(index * 5).padStart(2, '0'), index, OUTER),
);

/**
 * The M3 modal time picker, 24-hour (ADR-0067, design-system §9 «Time»): the dial view (the hour
 * and minute selectors over the dial, pointer drag and arrows) and the input view (two fields);
 * the lower left icon button switches them, «Отмена» / «ОК». `open` shows it with a value; `picked`
 * gives the time `HH:mm` on «ОК».
 */
@Component({
  selector: 'tb-time-picker',
  imports: [Button, Tooltip, TbDialog, DialogFooter],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="alert"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      (gone)="mounted.set(false)"
      [headline]="view() === 'dial' ? t.pick : t.enter"
    >
      @if (mounted()) {
        <div class="tb-time-picker" [class.tb-time-picker--input]="view() === 'input'">
          @if (view() === 'dial') {
            <div class="tb-time-picker__time">
              <button
                type="button"
                class="tb-time-picker__part"
                [attr.aria-pressed]="unit() === 'hour'"
                [attr.aria-label]="t.hour + ' ' + pad(hour())"
                (click)="unit.set('hour')"
              >
                {{ pad(hour()) }}
              </button>
              <span class="tb-time-picker__colon" aria-hidden="true">:</span>
              <button
                type="button"
                class="tb-time-picker__part"
                [attr.aria-pressed]="unit() === 'minute'"
                [attr.aria-label]="t.minute + ' ' + pad(minute())"
                (click)="unit.set('minute')"
              >
                {{ pad(minute()) }}
              </button>
            </div>
            <div
              #dial
              class="tb-time-picker__dial"
              role="slider"
              tabindex="0"
              [attr.aria-label]="unit() === 'hour' ? t.hour : t.minute"
              aria-valuemin="0"
              [attr.aria-valuemax]="unit() === 'hour' ? 23 : 59"
              [attr.aria-valuenow]="current()"
              [attr.aria-valuetext]="unit() === 'hour' ? t.hourOf(hour()) : t.minuteOf(minute())"
              (pointerdown)="press($event)"
              (pointermove)="drag($event)"
              (pointerup)="release()"
              (keydown)="key($event)"
            >
              <span
                class="tb-time-picker__hand"
                [style.height.px]="unit() === 'hour' && hour() >= 12 ? inner : outer"
                [style.transform]="'rotate(' + turn() + 'deg)'"
              ></span>
              <span class="tb-time-picker__centre"></span>
              @for (mark of marks(); track mark.value) {
                <span
                  class="tb-time-picker__mark"
                  [class.tb-time-picker__mark--on]="mark.value === current()"
                  [style.left.px]="mark.x"
                  [style.top.px]="mark.y"
                  aria-hidden="true"
                  >{{ mark.label }}</span
                >
              }
            </div>
          } @else {
            <div class="tb-time-picker__time">
              <label class="tb-time-picker__input">
                <input
                  #hourInput
                  inputmode="numeric"
                  maxlength="2"
                  autocomplete="off"
                  [attr.aria-label]="t.hour"
                  [attr.aria-invalid]="wrong() ? 'true' : null"
                  [value]="hourText()"
                  (input)="hourText.set(hourInput.value)"
                  (keydown.enter)="confirm()"
                />
                <span>{{ t.hours }}</span>
              </label>
              <span class="tb-time-picker__colon" aria-hidden="true">:</span>
              <label class="tb-time-picker__input">
                <input
                  #minuteInput
                  inputmode="numeric"
                  maxlength="2"
                  autocomplete="off"
                  [attr.aria-label]="t.minute"
                  [attr.aria-invalid]="wrong() ? 'true' : null"
                  [value]="minuteText()"
                  (input)="minuteText.set(minuteInput.value)"
                  (keydown.enter)="confirm()"
                />
                <span>{{ t.minutes }}</span>
              </label>
            </div>
          }
        </div>
      }
      <ng-template tbDialogFooter>
        @if (!short()) {
          <p-button
            class="tb-time-picker__switch"
            [icon]="view() === 'dial' ? 'tb-i tb-i-keyboard' : 'tb-i tb-i-schedule'"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [ariaLabel]="view() === 'dial' ? t.toInput : t.toDial"
            [pTooltip]="view() === 'dial' ? t.toInput : t.toDial"
            (onClick)="switchView()"
          />
        }
        <p-button [label]="c.cancel" [text]="true" (onClick)="visible.set(false)" />
        <p-button [label]="t.ok" [text]="true" (onClick)="confirm()" />
      </ng-template>
    </tb-dialog>
  `,
  styles: `
    /* vertical (M3): the selectors over the dial; ours: 24 dp between them */
    .tb-time-picker {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--tb-space-6);
    }

    .tb-time-picker__time {
      display: flex;
      align-items: flex-start;
      gap: var(--tb-space-1);
    }

    .tb-time-picker__colon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 5rem;
      color: var(--p-md-on-surface);
      font: var(--tb-type-display-s);
      letter-spacing: var(--tb-tracking-display-s);
    }

    /* M3 selectors: 114×80 dp (24 h), CornerSmall; the selected one primary-container */
    .tb-time-picker__part {
      width: 7.125rem;
      height: 5rem;
      padding: 0;
      border: 0;
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-surface-container-highest);
      color: var(--p-md-on-surface);
      font: var(--tb-type-display-s);
      letter-spacing: var(--tb-tracking-display-s);
      cursor: pointer;
      transition:
        background-color var(--tb-spring-fast-effects),
        color var(--tb-spring-fast-effects);

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-hover),
          var(--p-md-surface-container-highest)
        );
      }

      &[aria-pressed='true'] {
        background: var(--p-md-primary-container);
        color: var(--p-md-on-primary-container);
      }

      /* inside the box: the dialog content clips a ring drawn outside the full-width selectors */
      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: -3px;
      }
    }

    /* M3 dial: 256 dp, surface-container-highest; labels Body Large in 48 dp targets */
    .tb-time-picker__dial {
      position: relative;
      flex: none;
      width: 16rem;
      height: 16rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-surface-container-highest);
      cursor: pointer;
      touch-action: none;
      user-select: none;

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }
    }

    /* the 2 dp track from the centre and the 48 dp handle at its end, primary; no bounce (424.2) */
    .tb-time-picker__hand {
      position: absolute;
      bottom: 50%;
      left: calc(50% - 1px);
      width: 2px;
      background: var(--p-md-primary);
      transform-origin: bottom center;
      transition:
        transform var(--tb-spring-standard-fast-spatial),
        height var(--tb-spring-standard-fast-spatial);

      &::before {
        content: '';
        position: absolute;
        top: -1.5rem;
        left: calc(1px - 1.5rem);
        width: 3rem;
        height: 3rem;
        border-radius: var(--tb-shape-full);
        background: var(--p-md-primary);
      }
    }

    .tb-time-picker__centre {
      position: absolute;
      top: calc(50% - 4px);
      left: calc(50% - 4px);
      width: 8px;
      height: 8px;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary);
    }

    .tb-time-picker__mark {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      /* spacing-ok: no token — centres the clock handle on its point */
      margin: -1.5rem 0 0 -1.5rem;
      color: var(--p-md-on-surface);
      font: var(--tb-type-body-l);
      letter-spacing: var(--tb-tracking-body-l);
      pointer-events: none;
      transition: color var(--tb-spring-fast-effects);
    }

    .tb-time-picker__mark--on {
      color: var(--p-md-on-primary);
    }

    /* M3 input view: fields 96×72 dp, CornerSmall, the labels below (Body Small) */
    .tb-time-picker__input {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
      letter-spacing: var(--tb-tracking-body-s);

      input {
        box-sizing: border-box;
        width: 6rem;
        height: 4.5rem;
        border: 0;
        border-radius: var(--tb-shape-sm);
        background: var(--p-md-surface-container-highest);
        color: var(--p-md-on-surface);
        font: var(--tb-type-display-s);
        letter-spacing: var(--tb-tracking-display-s);
        text-align: center;
        transition:
          background-color var(--tb-spring-fast-effects),
          color var(--tb-spring-fast-effects);

        &:focus {
          outline: 2px solid var(--p-md-primary);
          outline-offset: -2px;
          background: var(--p-md-primary-container);
          color: var(--p-md-on-primary-container);
        }

        &[aria-invalid='true'] {
          outline: 2px solid var(--p-md-error);
          outline-offset: -2px;
        }
      }
    }

    .tb-time-picker--input .tb-time-picker__colon {
      height: 4.5rem;
    }

    /* M3 horizontal layout when the window is short (ours: below 560 px): selectors 96×80 dp beside the dial */
    @media (height < 35em) {
      .tb-time-picker:not(.tb-time-picker--input) {
        flex-direction: row;
        align-items: flex-start;
      }

      .tb-time-picker__part {
        width: 6rem;
      }
    }
  `,
})
export class TimePicker {
  protected readonly t = SHARED_T.time;
  protected readonly c = SHARED_T.common;
  protected readonly outer = OUTER;
  protected readonly inner = INNER;
  private readonly dial = viewChild<ElementRef<HTMLElement>>('dial');
  /** Ours: below 400 px of window height only the input view fits (M3 fallback). */
  protected readonly short = injectMedia('(height < 25em)');

  /** The minute step the dial snaps to and the arrows move by. */
  readonly step = input(5);
  readonly picked = output<string>();

  protected readonly visible = signal(false);
  /** The content stays until the leave animation ends: without it the dialog shrinks first. */
  protected readonly mounted = signal(false);
  protected readonly view = signal<TimeView>('dial');
  protected readonly unit = signal<Unit>('hour');
  protected readonly hour = signal(0);
  protected readonly minute = signal(0);
  protected readonly hourText = signal('');
  protected readonly minuteText = signal('');
  protected readonly wrong = signal(false);

  protected readonly current = computed(() =>
    this.unit() === 'hour' ? this.hour() : this.minute(),
  );
  protected readonly marks = computed(() => (this.unit() === 'hour' ? HOUR_MARKS : MINUTE_MARKS));
  private lastTurn = 0;
  /** The hand's rotation: it turns the short way round (355° → 0° goes on to 360°). */
  protected readonly turn = computed(() => {
    const angle = this.unit() === 'hour' ? (this.hour() % 12) * 30 : this.minute() * 6;
    this.lastTurn += ((((angle - this.lastTurn) % 360) + 540) % 360) - 180;
    return this.lastTurn;
  });
  private dragging = false;

  /** Shows the picker on `time` (`HH:mm`) or, without it, on now rounded down to the step. */
  open(time: string | null): void {
    const now = new Date();
    const [hour = 0, minute = 0] = (
      time ?? toHhMm(now.getHours(), now.getMinutes() - (now.getMinutes() % this.step()))
    )
      .split(':')
      .map(Number);
    this.hour.set(hour);
    this.minute.set(minute);
    this.unit.set('hour');
    this.view.set(this.short() ? 'input' : lastView);
    this.syncText();
    this.mounted.set(true);
    this.visible.set(true);
  }

  protected pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  protected switchView(): void {
    if (this.view() === 'dial') {
      this.syncText();
      lastView = 'input';
    } else if (this.readText()) {
      lastView = 'dial';
    } else {
      return;
    }
    this.view.set(lastView);
  }

  protected confirm(): void {
    if (this.view() === 'input' && !this.readText()) {
      return;
    }
    this.picked.emit(toHhMm(this.hour(), this.minute()));
    this.visible.set(false);
  }

  protected press(event: PointerEvent): void {
    this.dragging = true;
    this.dial()?.nativeElement.setPointerCapture(event.pointerId);
    this.drag(event);
  }

  protected drag(event: PointerEvent): void {
    const dial = this.dial()?.nativeElement;
    if (!this.dragging || dial === undefined) {
      return;
    }
    const box = dial.getBoundingClientRect();
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    this.set(dialValue(x, y, this.unit(), this.step()));
  }

  /** Letting go of the hour turns the dial to the minutes. */
  protected release(): void {
    this.dragging = false;
    this.unit.set('minute');
  }

  /** Arrows move by an hour or the step; Enter confirms the hour, then the time. */
  protected key(event: KeyboardEvent): void {
    const by = ARROWS[event.key] ?? 0;
    if (by !== 0) {
      event.preventDefault();
      this.set(this.unit() === 'hour' ? (this.hour() + by + 24) % 24 : this.nextMinute(by));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.unit() === 'hour') {
        this.unit.set('minute');
      } else {
        this.confirm();
      }
    }
  }

  /** The step before or after the minute (a typed 07 goes to 05 or 10). */
  private nextMinute(by: number): number {
    const step = this.step();
    const steps =
      by > 0 ? Math.floor(this.minute() / step) + 1 : Math.ceil(this.minute() / step) - 1;
    return (steps * step + 60) % 60;
  }

  private set(value: number): void {
    (this.unit() === 'hour' ? this.hour : this.minute).set(value);
  }

  private syncText(): void {
    this.hourText.set(this.pad(this.hour()));
    this.minuteText.set(this.pad(this.minute()));
    this.wrong.set(false);
  }

  /** The input view's fields into the time; `false` (and marked) when they are no time. */
  private readText(): boolean {
    const hour = /^\d{1,2}$/.test(this.hourText().trim()) ? Number(this.hourText()) : 99;
    const minute = /^\d{1,2}$/.test(this.minuteText().trim()) ? Number(this.minuteText()) : 99;
    const valid = hour < 24 && minute < 60;
    this.wrong.set(!valid);
    if (valid) {
      this.hour.set(hour);
      this.minute.set(minute);
    }
    return valid;
  }
}
