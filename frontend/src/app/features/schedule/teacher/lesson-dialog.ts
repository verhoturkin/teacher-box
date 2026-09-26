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
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { optionalText } from '../schedule-labels';

/** A student the teacher can plan a lesson with. */
export interface LessonStudent {
  readonly id: string;
  readonly displayName: string;
}

/** Prefilled time of a new lesson (e.g. selected in the calendar). */
export interface LessonSlot {
  readonly start: Date;
  readonly durationMinutes: number;
}

export const MEETING_URL_PATTERN = /^https?:\/\/\S+$/;

/**
 * Plans a single lesson or changes a planned one (time, duration, topic, link to the online
 * lesson). An overlap with another lesson is shown with an option to save anyway.
 */
@Component({
  selector: 'tb-lesson-dialog',
  imports: [ReactiveFormsModule, Button, DatePicker, Dialog, InputNumber, InputText, Message, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="lesson() === null ? 'Новое занятие' : 'Изменить занятие'"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '32rem' }"
      [draggable]="false"
    >
      <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="schedule-lesson-student">Ученик</label>
          <p-select
            inputId="schedule-lesson-student"
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
        <div class="tb-row">
          <div class="tb-field">
            <label for="schedule-lesson-start">Начало</label>
            <p-datepicker
              inputId="schedule-lesson-start"
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
            <label for="schedule-lesson-duration">Длительность, мин</label>
            <p-inputnumber
              inputId="schedule-lesson-duration"
              formControlName="durationMinutes"
              [min]="1"
              [max]="600"
              [showButtons]="true"
              [step]="15"
              [fluid]="true"
            />
          </div>
        </div>
        <div class="tb-field">
          <label for="schedule-lesson-topic">Тема</label>
          <input pInputText id="schedule-lesson-topic" formControlName="topic" autocomplete="off" />
        </div>
        <div class="tb-field">
          <label for="schedule-lesson-url">Ссылка на онлайн-урок</label>
          <input
            pInputText
            id="schedule-lesson-url"
            formControlName="meetingUrl"
            placeholder="https://telemost.yandex.ru/..."
            autocomplete="off"
          />
          @if (form.controls.meetingUrl.invalid) {
            <small class="tb-error">Ссылка должна начинаться с http:// или https://</small>
          }
        </div>
        @if (overlap()) {
          <p-message severity="warn" styleClass="tb-form-message">
            Время пересекается с другим занятием.
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
export class LessonDialog {
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly students = input.required<readonly LessonStudent[]>();
  /** The lesson to change; `null` plans a new one. */
  readonly lesson = input<ScheduledLesson | null>(null);
  /** Time of a new lesson. */
  readonly slot = input<LessonSlot | null>(null);
  readonly defaultDuration = input(60);
  readonly saved = output<ScheduledLesson>();

  protected readonly studentOptions = computed(() =>
    this.students().map((student) => ({ label: student.displayName, value: student.id })),
  );
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly overlap = signal(false);

  readonly form = new FormGroup({
    studentId: new FormControl<string | null>(null, [Validators.required]),
    startsAt: new FormControl<Date | null>(null, [Validators.required]),
    durationMinutes: new FormControl<number | null>(60, [
      Validators.required,
      Validators.min(1),
      Validators.max(600),
    ]),
    topic: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    meetingUrl: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000), Validators.pattern(MEETING_URL_PATTERN)],
    }),
  });

  constructor() {
    // Opening or another lesson/slot resets the form; later inputs (settings, students) keep what is typed.
    effect(() => {
      this.lesson();
      this.slot();
      if (this.visible()) {
        untracked(() => {
          this.reset();
        });
      }
    });
  }

  save(allowOverlap = false): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || this.pending() || value.studentId === null || value.startsAt === null) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.overlap.set(false);
    const details = {
      startsAt: value.startsAt.toISOString(),
      durationMinutes: value.durationMinutes ?? this.defaultDuration(),
      topic: optionalText(value.topic),
      meetingUrl: optionalText(value.meetingUrl),
      allowOverlap,
    };
    const lesson = this.lesson();
    const request =
      lesson === null
        ? this.api.plan({ studentId: value.studentId, ...details })
        : this.api.edit(lesson.id, details);
    request.subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.visible.set(false);
        this.saved.emit(saved);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        if (problemCode(error) === 'schedule.overlap') {
          this.overlap.set(true);
        } else {
          this.error.set(describeError(error, 'Не удалось сохранить занятие'));
        }
      },
    });
  }

  private reset(): void {
    this.error.set(null);
    this.overlap.set(false);
    const lesson = this.lesson();
    const slot = this.slot();
    this.form.reset({
      studentId: lesson?.studentId ?? null,
      startsAt: lesson === null ? (slot?.start ?? null) : new Date(lesson.startsAt),
      durationMinutes: lesson?.durationMinutes ?? slot?.durationMinutes ?? this.defaultDuration(),
      topic: lesson?.topic ?? '',
      meetingUrl: lesson?.meetingUrl ?? '',
    });
    if (lesson === null) {
      this.form.controls.studentId.enable();
    } else {
      this.form.controls.studentId.disable();
    }
  }
}
