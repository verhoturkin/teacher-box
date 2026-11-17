import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { dayOf, earliestTime, joinDateTime, timeOf } from '@shared/dates/date-time';
import { SHARED_T } from '@shared/i18n/texts';
import { DateField } from './date-field';
import { TimeField } from './time-field';

/**
 * A date with a time (ADR-0067, design-system §9 «Date and time»): `tb-date-field` and
 * `tb-time-field` in one row, each with its own label. Value — one `Date` (`null` until both
 * fields hold a fitting value) joined and split in the browser's zone, as the screens send it.
 * `minDate` — the earliest moment: no day before it and, on its day, no time before it (rounded up
 * to `step`). The row's error (a wrong text, too early) goes under the row (`tbFieldErrors`).
 *
 * ```html
 * <div class="tb-field">
 *   <tb-date-time-field inputId="lesson-start" [label]="t.start" formControlName="startsAt" />
 * </div>
 * ```
 */
@Component({
  selector: 'tb-date-time-field',
  imports: [FormsModule, DateField, TimeField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateTimeField), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateTimeField), multi: true },
  ],
  host: { '(focusout)': 'left()' },
  styles: `
    /* ours: 3fr / 2fr with a 16 dp gap, never stacked (design-system §9) */
    :host {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: var(--tb-space-4);
    }
  `,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ label() }}</label>
      <tb-date-field
        [inputId]="inputId()"
        [label]="label()"
        [minDate]="minDate()"
        [ngModel]="day()"
        (ngModelChange)="day.set($event); update()"
        [disabled]="disabled()"
      />
    </div>
    <div class="tb-field">
      <label [for]="inputId() + '-time'">{{ t.time.label }}</label>
      <tb-time-field
        [inputId]="inputId() + '-time'"
        [step]="step()"
        [ngModel]="time()"
        (ngModelChange)="time.set($event); update()"
        [disabled]="disabled()"
      />
    </div>
  `,
})
export class DateTimeField implements ControlValueAccessor, Validator {
  protected readonly t = SHARED_T;

  /** The `id` of the date input; the time input gets `<inputId>-time`. */
  readonly inputId = input.required<string>();
  /** The label of the date field and the headline of its picker. */
  readonly label = input.required<string>();
  readonly minDate = input<Date | null>(null);
  /** The minutes the dial snaps to. */
  readonly step = input(5);

  protected readonly day = signal<Date | null>(null);
  protected readonly time = signal<string | null>(null);
  protected readonly disabled = signal(false);
  private readonly earliest = computed(() => {
    const day = this.day();
    return day === null ? null : earliestTime(day, this.minDate(), this.step());
  });
  private readonly dateField = viewChild.required(DateField);
  private readonly timeField = viewChild.required(TimeField);
  private value: Date | null = null;

  private onChange: (value: Date | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;

  writeValue(value: unknown): void {
    const moment = value instanceof Date ? value : null;
    this.value = moment;
    this.day.set(moment === null ? null : dayOf(moment));
    this.time.set(moment === null ? null : timeOf(moment));
  }

  registerOnChange(fn: (value: Date | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  validate(): ValidationErrors | null {
    return this.dateField().validate() ?? this.timeField().validate() ?? this.tooEarly();
  }

  /** Leaving a field: a wrong text shows only then (the fields parse on blur). */
  protected left(): void {
    this.onTouched();
    this.onValidatorChange();
  }

  protected update(): void {
    const day = this.day();
    const time = this.time();
    const value =
      day === null || time === null || this.tooEarly() !== null ? null : joinDateTime(day, time);
    this.onValidatorChange();
    if (value?.getTime() !== this.value?.getTime()) {
      this.value = value;
      this.onChange(value);
    }
  }

  private tooEarly(): ValidationErrors | null {
    const earliest = this.earliest();
    const time = this.time();
    return earliest !== null && time !== null && time < earliest
      ? { time: this.t.date.min(earliest) }
      : null;
  }
}
