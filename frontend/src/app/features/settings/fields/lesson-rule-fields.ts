import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { T } from '../i18n/texts';

/**
 * The number fields of the lesson settings, each one setting (Settings › Занятия and the first setup). A
 * field only edits its control; the host saves on `committed` — leaving the field or Enter — or later.
 */
const t = T.page;

/** The default lesson length, minutes (15–480, as the server takes). */
@Component({
  selector: 'tb-duration-field',
  imports: [ReactiveFormsModule, InputNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ t.durationLabel }}</label>
      <p-inputnumber
        [inputId]="inputId()"
        [formControl]="control()"
        [suffix]="t.durationSuffix"
        [min]="15"
        [max]="480"
        [fluid]="true"
        (onBlur)="committed.emit()"
        (keydown.enter)="committed.emit()"
      />
      @if (hint()) {
        <small class="tb-hint">{{ t.durationHint }}</small>
      }
    </div>
  `,
})
export class DurationField {
  readonly control = input.required<FormControl<number | null>>();
  readonly inputId = input('duration-input');
  /** Its own hint (the first setup); in Settings one hint serves the length and the price. */
  readonly hint = input(false);
  readonly committed = output();
  protected readonly t = t;
}

/** Late cancellation, hours before the lesson (0–168). */
@Component({
  selector: 'tb-late-cancellation-field',
  imports: [ReactiveFormsModule, InputNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ t.lateLabel }}</label>
      <p-inputnumber
        [inputId]="inputId()"
        [formControl]="control()"
        [suffix]="t.hoursSuffix"
        [min]="0"
        [max]="168"
        [maxFractionDigits]="2"
        [fluid]="true"
        (onBlur)="committed.emit()"
        (keydown.enter)="committed.emit()"
      />
      <small class="tb-hint">{{ t.lateHint }}</small>
    </div>
  `,
})
export class LateCancellationField {
  readonly control = input.required<FormControl<number | null>>();
  readonly inputId = input('late-input');
  readonly committed = output();
  protected readonly t = t;
}

/** The reminder before a homework deadline, hours (1–72). */
@Component({
  selector: 'tb-due-soon-field',
  imports: [ReactiveFormsModule, InputNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ t.dueSoonLabel }}</label>
      <p-inputnumber
        [inputId]="inputId()"
        [formControl]="control()"
        [suffix]="t.hoursSuffix"
        [min]="1"
        [max]="72"
        [maxFractionDigits]="2"
        [fluid]="true"
        (onBlur)="committed.emit()"
        (keydown.enter)="committed.emit()"
      />
    </div>
  `,
})
export class DueSoonField {
  readonly control = input.required<FormControl<number | null>>();
  readonly inputId = input('due-soon-input');
  readonly committed = output();
  protected readonly t = t;
}

/** How far ahead the lessons of a series are booked, weeks (4–26). */
@Component({
  selector: 'tb-horizon-field',
  imports: [ReactiveFormsModule, InputNumber],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label [for]="inputId()">{{ t.horizonLabel }}</label>
      <p-inputnumber
        [inputId]="inputId()"
        [formControl]="control()"
        [suffix]="t.weeksSuffix"
        [min]="4"
        [max]="26"
        [fluid]="true"
        (onBlur)="committed.emit()"
        (keydown.enter)="committed.emit()"
      />
      <small class="tb-hint">{{ t.horizonHint }}</small>
    </div>
  `,
})
export class HorizonField {
  readonly control = input.required<FormControl<number | null>>();
  readonly inputId = input('horizon-input');
  readonly committed = output();
  protected readonly t = t;
}

/** The teacher's working hours of every day, `HH:mm` in the teacher's zone; the end after the start. */
@Component({
  selector: 'tb-working-hours-field',
  imports: [ReactiveFormsModule, DatePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="tb-field tb-working-hours">
      <legend>{{ t.workLabel }}</legend>
      <div class="tb-working-hours__two">
        <div class="tb-field">
          <label [for]="inputId() + '-start'">{{ t.workFrom }}</label>
          <p-datepicker
            [inputId]="inputId() + '-start'"
            [formControl]="start()"
            [timeOnly]="true"
            hourFormat="24"
            [stepMinute]="15"
            appendTo="body"
            [fluid]="true"
            (onClose)="committed.emit()"
            (keydown.enter)="committed.emit()"
          />
        </div>
        <div class="tb-field">
          <label [for]="inputId() + '-end'">{{ t.workTo }}</label>
          <p-datepicker
            [inputId]="inputId() + '-end'"
            [formControl]="end()"
            [timeOnly]="true"
            hourFormat="24"
            [stepMinute]="15"
            appendTo="body"
            [fluid]="true"
            (onClose)="committed.emit()"
            (keydown.enter)="committed.emit()"
          />
        </div>
      </div>
      <small class="tb-hint">{{ t.workHint }}</small>
    </fieldset>
  `,
  styles: `
    .tb-working-hours {
      margin: 0;
      padding: 0;
      border: 0;
      min-width: 0;

      legend {
        padding: 0;
        margin-block-end: var(--tb-space-2);
      }
    }

    .tb-working-hours__two {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
      gap: var(--tb-space-3);
    }
  `,
})
export class WorkingHoursField {
  readonly start = input.required<FormControl<Date | null>>();
  readonly end = input.required<FormControl<Date | null>>();
  readonly inputId = input('work');
  readonly committed = output();
  protected readonly t = t;
}
