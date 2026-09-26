import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import { ScheduleApi } from '../data-access/schedule-api';
import { LessonSeries, SeriesPlanned, Weekday } from '../data-access/schedule.models';
import { WEEKDAYS, browserTimeZone, optionalText } from '../schedule-labels';
import { LessonStudent, MEETING_URL_PATTERN } from './lesson-dialog';

export const INTERVAL_OPTIONS = [
  { label: 'Каждую неделю', value: 1 },
  { label: 'Раз в 2 недели', value: 2 },
  { label: 'Раз в 3 недели', value: 3 },
  { label: 'Раз в 4 недели', value: 4 },
];

/**
 * Regular lessons: days of the week, time and period. Changing a series applies from the chosen
 * day on; earlier lessons stay as they are.
 */
@Component({
  selector: 'tb-series-dialog',
  imports: [ReactiveFormsModule, Button, DatePicker, Dialog, InputNumber, InputText, Message, Select, SelectButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="series() === null ? 'Регулярные занятия' : 'Изменить регулярные занятия'"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '34rem' }"
      [draggable]="false"
    >
      <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="series-student">Ученик</label>
          <p-select
            inputId="series-student"
            formControlName="studentId"
            [options]="studentOptions()"
            optionLabel="label"
            optionValue="value"
            placeholder="Выберите ученика"
            [filter]="true"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-field">
          <span id="series-weekdays-label">Дни недели</span>
          <p-selectbutton
            formControlName="weekdays"
            [options]="weekdays"
            optionLabel="short"
            optionValue="value"
            [multiple]="true"
            ariaLabelledBy="series-weekdays-label"
          />
        </div>
        <div class="tb-row">
          <div class="tb-field">
            <label for="series-time">Время</label>
            <p-datepicker
              inputId="series-time"
              formControlName="startTime"
              [timeOnly]="true"
              hourFormat="24"
              [stepMinute]="5"
              appendTo="body"
              [fluid]="true"
            />
          </div>
          <div class="tb-field">
            <label for="series-duration">Длительность, мин</label>
            <p-inputnumber
              inputId="series-duration"
              formControlName="durationMinutes"
              [min]="1"
              [max]="600"
              [showButtons]="true"
              [step]="15"
              [fluid]="true"
            />
          </div>
        </div>
        @if (otherTimeZone(); as zone) {
          <small class="tb-hint">Время указывается по часовому поясу портала: {{ zone }}.</small>
        }
        <div class="tb-field">
          <label for="series-interval">Повтор</label>
          <p-select
            inputId="series-interval"
            formControlName="intervalWeeks"
            [options]="intervals"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-row">
          <div class="tb-field">
            <label for="series-starts">{{ series() === null ? 'С даты' : 'Изменить с даты' }}</label>
            <p-datepicker
              inputId="series-starts"
              formControlName="startsOn"
              dateFormat="dd.mm.yy"
              [showIcon]="true"
              [showOnFocus]="false"
              appendTo="body"
              [fluid]="true"
            />
          </div>
          <div class="tb-field">
            <label for="series-ends">По дату (необязательно)</label>
            <p-datepicker
              inputId="series-ends"
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
        <div class="tb-field">
          <label for="series-topic">Тема</label>
          <input pInputText id="series-topic" formControlName="topic" autocomplete="off" />
        </div>
        <div class="tb-field">
          <label for="series-url">Ссылка на онлайн-урок</label>
          <input pInputText id="series-url" formControlName="meetingUrl" autocomplete="off" />
          @if (form.controls.meetingUrl.invalid) {
            <small class="tb-error">Ссылка должна начинаться с http:// или https://</small>
          }
        </div>
        @if (overlap()) {
          <p-message severity="warn" styleClass="tb-form-message">
            Некоторые занятия пересекаются с уже запланированными.
            <p-button label="Всё равно сохранить" [link]="true" size="small" (onClick)="save(true)" />
          </p-message>
        }
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Отмена" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button label="Сохранить" [loading]="pending()" [disabled]="form.invalid" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class SeriesDialog {
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly students = input.required<readonly LessonStudent[]>();
  /** The series to change; `null` plans a new one. */
  readonly series = input<LessonSeries | null>(null);
  readonly defaultDuration = input(60);
  /** Time zone of the portal (series times are local times of this zone). */
  readonly timeZone = input<string | null>(null);
  readonly saved = output<SeriesPlanned>();

  protected readonly weekdays = [...WEEKDAYS];
  protected readonly intervals = INTERVAL_OPTIONS;
  protected readonly studentOptions = computed(() =>
    this.students().map((student) => ({ label: student.displayName, value: student.id })),
  );
  protected readonly otherTimeZone = computed(() => {
    const zone = this.timeZone();
    return zone === null || zone === browserTimeZone() ? null : zone;
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly overlap = signal(false);

  readonly form = new FormGroup({
    studentId: new FormControl<string | null>(null, [Validators.required]),
    weekdays: new FormControl<Weekday[]>([], { nonNullable: true, validators: [Validators.required] }),
    startTime: new FormControl<Date | null>(null, [Validators.required]),
    durationMinutes: new FormControl<number | null>(60, [
      Validators.required,
      Validators.min(1),
      Validators.max(600),
    ]),
    intervalWeeks: new FormControl(1, { nonNullable: true }),
    startsOn: new FormControl<Date | null>(null, [Validators.required]),
    endsOn: new FormControl<Date | null>(null),
    topic: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    meetingUrl: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000), Validators.pattern(MEETING_URL_PATTERN)],
    }),
  });

  constructor() {
    // Opening or another series resets the form; later inputs (settings, students) keep what is typed.
    effect(() => {
      this.series();
      if (this.visible()) {
        untracked(() => {
          this.reset();
        });
      }
    });
  }

  save(allowOverlap = false): void {
    const value = this.form.getRawValue();
    if (
      this.form.invalid ||
      this.pending() ||
      value.studentId === null ||
      value.startTime === null ||
      value.startsOn === null
    ) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.overlap.set(false);
    const request = {
      studentId: value.studentId,
      weekdays: WEEKDAYS.map((day) => day.value).filter((day) => value.weekdays.includes(day)),
      startTime: toTime(value.startTime),
      durationMinutes: value.durationMinutes ?? this.defaultDuration(),
      intervalWeeks: value.intervalWeeks,
      startsOn: toIsoDate(value.startsOn),
      endsOn: value.endsOn === null ? null : toIsoDate(value.endsOn),
      topic: optionalText(value.topic),
      meetingUrl: optionalText(value.meetingUrl),
      allowOverlap,
    };
    const series = this.series();
    const call = series === null ? this.api.planSeries(request) : this.api.changeSeries(series.id, request);
    call.subscribe({
      next: (planned) => {
        this.pending.set(false);
        this.visible.set(false);
        this.saved.emit(planned);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        if (problemCode(error) === 'schedule.overlap') {
          this.overlap.set(true);
        } else {
          this.error.set(describeError(error, 'Не удалось сохранить расписание'));
        }
      },
    });
  }

  private reset(): void {
    this.error.set(null);
    this.overlap.set(false);
    const series = this.series();
    const endsOn = series?.endsOn ?? null;
    this.form.reset({
      studentId: series?.studentId ?? null,
      weekdays: series?.weekdays ?? [],
      startTime: series === null ? null : fromTime(series.startTime),
      durationMinutes: series?.durationMinutes ?? this.defaultDuration(),
      intervalWeeks: series?.intervalWeeks ?? 1,
      startsOn: series === null ? new Date() : laterOf(fromIsoDate(series.startsOn), new Date()),
      endsOn: endsOn === null ? null : fromIsoDate(endsOn),
      topic: series?.topic ?? '',
      meetingUrl: series?.meetingUrl ?? '',
    });
    if (series === null) {
      this.form.controls.studentId.enable();
    } else {
      this.form.controls.studentId.disable();
    }
  }
}

/** `HH:mm` of a time picked in the dialog. */
export function toTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** A date today with the time `HH:mm[:ss]` (for the time picker). */
export function fromTime(time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function laterOf(first: Date, second: Date): Date {
  return first > second ? first : second;
}
