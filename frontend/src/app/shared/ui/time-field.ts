import { ChangeDetectionStrategy, Component, forwardRef, input } from '@angular/core';
import { NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors } from '@angular/forms';
import { InputText } from 'primeng/inputtext';
import { parseTime } from '@shared/dates/typed-time';
import { SHARED_T } from '@shared/i18n/texts';
import { TimePicker } from './time-picker';
import { TypedField } from './typed-field';

/**
 * The M3 time field (ADR-0067, design-system §9 «Time»): a filled field that takes a typed time
 * (`shared/dates/typed-time`, parsed on Enter or leaving the field) and a trailing «Выбрать время»
 * icon button that opens `tb-time-picker`. Value — `HH:mm` or `null` (a form's `HH:mm:ss` is read
 * too); `step` — the minutes the dial snaps to.
 *
 * ```html
 * <div class="tb-field">
 *   <label for="work-start">{{ t.from }}</label>
 *   <tb-time-field inputId="work-start" [step]="15" formControlName="workStart" />
 * </div>
 * ```
 */
@Component({
  selector: 'tb-time-field',
  imports: [InputText, TimePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimeField), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => TimeField), multi: true },
  ],
  template: `
    <input
      #field
      pInputText
      [id]="inputId()"
      [value]="text()"
      [placeholder]="t.format"
      [disabled]="disabled()"
      [class.p-filled]="text() !== ''"
      autocomplete="off"
      (input)="text.set(field.value)"
      (keydown.enter)="readText()"
      (blur)="readText(); onTouched()"
    />
    <button
      type="button"
      class="tb-typed-field__open"
      aria-haspopup="dialog"
      [attr.aria-label]="t.open"
      [disabled]="disabled()"
      (click)="picker.open(value())"
    >
      <i class="tb-i tb-i-schedule" aria-hidden="true"></i>
    </button>
    <tb-time-picker #picker [step]="step()" (picked)="choose($event)" />
  `,
})
export class TimeField extends TypedField<string> {
  protected readonly t = SHARED_T.time;

  /** The `id` of the input, for the `<label for>` of the field. */
  readonly inputId = input.required<string>();
  /** The minutes the dial snaps to (5 or 15). */
  readonly step = input(5);

  protected override read(value: unknown): string | null {
    return typeof value === 'string' ? parseTime(value.slice(0, 5)) : null;
  }

  protected override parse(text: string): string | null {
    return parseTime(text);
  }

  protected override format(time: string): string {
    return time;
  }

  protected override wrongError(): ValidationErrors {
    return { time: this.t.wrong(this.t.format) };
  }

  /** Any time of the day will do. */
  protected override check(): null {
    return null;
  }
}
