import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { SelectButton } from 'primeng/selectbutton';
import { describeError } from '@core/http/error-messages';
import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import { ScheduleApi } from '../data-access/schedule-api';
import { OffTime, OffTimeKind, OffTimeRequest, Weekday } from '../data-access/schedule.models';
import { WEEKDAYS, browserTimeZone, optionalText } from '../schedule-labels';
import { fromTime, toTime } from './lesson-time';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

const KIND_OPTIONS: readonly { label: string; value: OffTimeKind }[] = [
  { label: T.offTime.once, value: 'ONCE' },
  { label: T.offTime.weekly, value: 'WEEKLY' },
];

/** Controls of each kind of off time; the controls of the other kind are disabled. */
const ONCE_CONTROLS = ['startsAt', 'endsAt'] as const;
const WEEKLY_CONTROLS = ['weekdays', 'startTime', 'endTime', 'startsOn', 'endsOn'] as const;

/**
 * The teacher's off time: once (from a moment to a moment, e.g. a holiday) or every week (days of the
 * week and hours, e.g. a lunch or a day off). Students see it as busy time.
 */
@Component({
  selector: 'tb-off-time-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    DatePicker,
    Dialog,
    InputText,
    Message,
    SelectButton,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="offTime() === null ? t.newTitle : t.editTitle"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <form tbFieldErrors id="off-time-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <p class="tb-hint">{{ t.hint }}</p>
        <div class="tb-field">
          <span id="off-time-kind-label">{{ t.repeat }}</span>
          <p-selectbutton
            formControlName="kind"
            [options]="kinds"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            ariaLabelledBy="off-time-kind-label"
          />
        </div>
        @if (weekly()) {
          <div class="tb-field">
            <span id="off-time-weekdays-label">{{ t.weekdays }}</span>
            <p-selectbutton
              formControlName="weekdays"
              [options]="weekdays"
              optionLabel="short"
              optionValue="value"
              [multiple]="true"
              ariaLabelledBy="off-time-weekdays-label"
            />
          </div>
          <div class="tb-row">
            <div class="tb-field">
              <label for="off-time-start-time">{{ t.from }}</label>
              <p-datepicker
                inputId="off-time-start-time"
                formControlName="startTime"
                [timeOnly]="true"
                hourFormat="24"
                [stepMinute]="5"
                appendTo="body"
                [fluid]="true"
              />
            </div>
            <div class="tb-field">
              <label for="off-time-end-time">{{ t.to }}</label>
              <p-datepicker
                inputId="off-time-end-time"
                formControlName="endTime"
                [timeOnly]="true"
                hourFormat="24"
                [stepMinute]="5"
                appendTo="body"
                [fluid]="true"
              />
            </div>
          </div>
          <small class="tb-hint">
            {{ t.nextDay }}
            @if (otherTimeZone(); as zone) {
              {{ t.zone(zone) }}
            }
          </small>
          <div class="tb-row">
            <div class="tb-field">
              <label for="off-time-starts-on">{{ t.fromDate }}</label>
              <p-datepicker
                inputId="off-time-starts-on"
                formControlName="startsOn"
                dateFormat="dd.mm.yy"
                [showIcon]="true"
                [showOnFocus]="false"
                appendTo="body"
                [fluid]="true"
              />
            </div>
            <div class="tb-field">
              <label for="off-time-ends-on">{{ t.toDate }}</label>
              <p-datepicker
                inputId="off-time-ends-on"
                formControlName="endsOn"
                dateFormat="dd.mm.yy"
                [showIcon]="true"
                [showOnFocus]="false"
                [showClear]="true"
                appendTo="body"
                [fluid]="true"
              />
            </div>
          </div>
        } @else {
          <div class="tb-row">
            <div class="tb-field">
              <label for="off-time-starts-at">{{ t.from }}</label>
              <p-datepicker
                inputId="off-time-starts-at"
                formControlName="startsAt"
                dateFormat="dd.mm.yy"
                [showTime]="true"
                hourFormat="24"
                [stepMinute]="5"
                [showIcon]="true"
                [showOnFocus]="false"
                appendTo="body"
                [fluid]="true"
              />
            </div>
            <div class="tb-field">
              <label for="off-time-ends-at">{{ t.to }}</label>
              <p-datepicker
                inputId="off-time-ends-at"
                formControlName="endsAt"
                dateFormat="dd.mm.yy"
                [showTime]="true"
                hourFormat="24"
                [stepMinute]="5"
                [showIcon]="true"
                [showOnFocus]="false"
                appendTo="body"
                [fluid]="true"
              />
            </div>
          </div>
        }
        <div class="tb-field">
          <label for="off-time-note">{{ t.note }}</label>
          <input
            pInputText
            id="off-time-note"
            formControlName="note"
            [placeholder]="t.notePlaceholder"
            autocomplete="off"
          />
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="visible.set(false)"
        />
        <p-button
          [label]="c.save"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="off-time-form"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class OffTimeDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.offTime;
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  /** The off time to change; `null` adds a new one. */
  readonly offTime = input<OffTime | null>(null);
  /** Time zone of the portal (weekly times are local times of this zone). */
  readonly timeZone = input<string | null>(null);
  readonly saved = output<OffTime>();

  protected readonly kinds = [...KIND_OPTIONS];
  protected readonly weekdays = [...WEEKDAYS];
  protected readonly otherTimeZone = computed(() => {
    const zone = this.timeZone();
    return zone === null || zone === browserTimeZone() ? null : zone;
  });
  protected readonly weekly = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    kind: new FormControl<OffTimeKind>('ONCE', { nonNullable: true }),
    startsAt: new FormControl<Date | null>(null, [Validators.required]),
    endsAt: new FormControl<Date | null>(null, [Validators.required]),
    weekdays: new FormControl<Weekday[]>([], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    startTime: new FormControl<Date | null>(null, [Validators.required]),
    endTime: new FormControl<Date | null>(null, [Validators.required]),
    startsOn: new FormControl<Date | null>(null, [Validators.required]),
    endsOn: new FormControl<Date | null>(null),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
  });

  constructor() {
    this.form.controls.kind.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((kind) => {
        this.applyKind(kind);
      });
    // Opening or another off time resets the form.
    effect(() => {
      this.offTime();
      if (this.visible()) {
        untracked(() => {
          this.reset();
        });
      }
    });
  }

  save(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    const weekly = value.kind === 'WEEKLY';
    const request: OffTimeRequest = {
      kind: value.kind,
      startsAt: weekly ? null : isoInstant(value.startsAt),
      endsAt: weekly ? null : isoInstant(value.endsAt),
      weekdays: weekly
        ? WEEKDAYS.map((day) => day.value).filter((day) => value.weekdays.includes(day))
        : [],
      startTime: weekly && value.startTime !== null ? toTime(value.startTime) : null,
      endTime: weekly && value.endTime !== null ? toTime(value.endTime) : null,
      startsOn: weekly && value.startsOn !== null ? toIsoDate(value.startsOn) : null,
      endsOn: weekly && value.endsOn !== null ? toIsoDate(value.endsOn) : null,
      note: optionalText(value.note),
    };
    this.pending.set(true);
    this.error.set(null);
    const offTime = this.offTime();
    const call =
      offTime === null
        ? this.api.createOffTime(request)
        : this.api.changeOffTime(offTime.id, request);
    call.subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.visible.set(false);
        this.saved.emit(saved);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, T.offTime.failed));
      },
    });
  }

  private reset(): void {
    this.error.set(null);
    const offTime = this.offTime();
    const start = nextHour();
    const startsAt = offTime?.startsAt ?? null;
    const endsAt = offTime?.endsAt ?? null;
    const startsOn = offTime?.startsOn ?? null;
    const endsOn = offTime?.endsOn ?? null;
    this.form.reset({
      kind: offTime?.kind ?? 'ONCE',
      startsAt: startsAt === null ? start : new Date(startsAt),
      endsAt: endsAt === null ? new Date(start.getTime() + 3_600_000) : new Date(endsAt),
      weekdays: offTime?.weekdays ?? [],
      startTime: fromTime(offTime?.startTime ?? '13:00'),
      endTime: fromTime(offTime?.endTime ?? '14:00'),
      startsOn: startsOn === null ? new Date() : fromIsoDate(startsOn),
      endsOn: endsOn === null ? null : fromIsoDate(endsOn),
      note: offTime?.note ?? '',
    });
    this.applyKind(this.form.controls.kind.value);
  }

  /** Only the fields of the chosen kind count. */
  private applyKind(kind: OffTimeKind): void {
    const weekly = kind === 'WEEKLY';
    this.weekly.set(weekly);
    for (const name of ONCE_CONTROLS) {
      if (weekly) {
        this.form.controls[name].disable({ emitEvent: false });
      } else {
        this.form.controls[name].enable({ emitEvent: false });
      }
    }
    for (const name of WEEKLY_CONTROLS) {
      if (weekly) {
        this.form.controls[name].enable({ emitEvent: false });
      } else {
        this.form.controls[name].disable({ emitEvent: false });
      }
    }
  }
}

function isoInstant(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

/** The start of the next hour. */
function nextHour(): Date {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}
