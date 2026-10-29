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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { Button } from 'primeng/button';
import { DatePicker } from 'primeng/datepicker';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { ScheduleApi } from '../data-access/schedule-api';
import { FollowingLessons, RepeatScope, ScheduledLesson } from '../data-access/schedule.models';
import { toIsoDate } from '@shared/dates/iso-date';
import { optionalText } from '../schedule-labels';
import {
  LessonGroup,
  OwnerValue,
  defaultTopic,
  followDefaultTopic,
  ownerIds,
  ownerOptions,
  ownerValue,
} from './lesson-owner';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** A student the teacher can plan a lesson with. */
export interface LessonStudent {
  readonly id: string;
  readonly displayName: string;
  /** Topic of a new lesson with the student, if the teacher set one. */
  readonly defaultTopic?: string | null;
}

/** Prefilled time of a new lesson (e.g. selected in the calendar). */
export interface LessonSlot {
  readonly start: Date;
  readonly durationMinutes: number;
}

export const MEETING_URL_PATTERN = /^https?:\/\/\S+$/;

/**
 * Plans a single lesson with a student or a group, or changes a planned one (time, duration,
 * topic, link to the online lesson). An overlap with another lesson is shown with an option to save anyway.
 */
@Component({
  selector: 'tb-lesson-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    DatePicker,
    TbDialog,
    InputNumber,
    InputText,
    Message,
    Select,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="lesson() === null ? t.newLesson : t.editLesson"
      [confirmLabel]="c.save"
      formId="lesson-form"
      [pending]="pending()"
      [error]="error()"
      [dirty]="dirty()"
    >
      <form tbFieldErrors id="lesson-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="schedule-lesson-student">{{ t.with }}</label>
          <p-select
            inputId="schedule-lesson-student"
            formControlName="owner"
            [options]="ownerOptions()"
            [group]="true"
            optionGroupLabel="label"
            optionGroupChildren="items"
            optionLabel="label"
            optionValue="value"
            [placeholder]="t.chooseOwner"
            [filter]="true"
            [filterPlaceholder]="t.search"
            [ariaFilterLabel]="t.search"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-row">
          <div class="tb-field">
            <label for="schedule-lesson-start">{{ t.start }}</label>
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
            <label for="schedule-lesson-duration">{{ t.duration }}</label>
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
          <label id="schedule-lesson-repeat-label" for="schedule-lesson-repeat">{{
            t.repeat
          }}</label>
          <p-select
            inputId="schedule-lesson-repeat"
            ariaLabelledBy="schedule-lesson-repeat-label"
            formControlName="repeatWeeks"
            [options]="repeats"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        @if (repeatWeeks() > 0) {
          <div class="tb-field">
            <label for="schedule-lesson-repeat-until">{{ t.repeatUntil }}</label>
            <p-datepicker
              inputId="schedule-lesson-repeat-until"
              formControlName="repeatUntil"
              dateFormat="dd.mm.yy"
              [showIcon]="true"
              [showOnFocus]="false"
              [showClear]="true"
              appendTo="body"
              [fluid]="true"
            />
          </div>
        }
        @if (lesson()?.seriesId) {
          <div class="tb-field">
            <label id="schedule-lesson-scope-label" for="schedule-lesson-scope">{{
              t.scope
            }}</label>
            <p-select
              inputId="schedule-lesson-scope"
              ariaLabelledBy="schedule-lesson-scope-label"
              formControlName="scope"
              [options]="scopes"
              optionLabel="label"
              optionValue="value"
              appendTo="body"
              [fluid]="true"
            />
          </div>
          @if (preview(); as affected) {
            <p-message severity="info">{{
              t.affected(affected.affected.length, affected.protectedLessons.length)
            }}</p-message>
          }
        }
        <div class="tb-field">
          <label for="schedule-lesson-title">{{ t.name }}</label>
          <input
            pInputText
            id="schedule-lesson-title"
            formControlName="title"
            autocomplete="off"
            [placeholder]="ownerName()"
          />
        </div>
        <div class="tb-field">
          <label for="schedule-lesson-topic">{{ t.topic }}</label>
          <input pInputText id="schedule-lesson-topic" formControlName="topic" autocomplete="off" />
        </div>
        <div class="tb-field">
          <label for="schedule-lesson-url">{{ t.url }}</label>
          <input
            pInputText
            id="schedule-lesson-url"
            formControlName="meetingUrl"
            placeholder="https://telemost.yandex.ru/..."
            autocomplete="off"
          />
          @if (form.controls.meetingUrl.invalid) {
            <small class="tb-error">{{ t.urlInvalid }}</small>
          }
        </div>
        @if (overlap()) {
          <p-message severity="warn" styleClass="tb-form-message">
            {{ t.overlap }}
            <p-button [label]="t.saveAnyway" [text]="true" (onClick)="save(true)" />
          </p-message>
        }
      </form>
    </tb-dialog>
  `,
})
export class LessonDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.lessonDialog;
  private readonly api = inject(ScheduleApi);

  readonly visible = model(false);
  readonly students = input.required<readonly LessonStudent[]>();
  /** Groups with students; empty when the teacher has none. */
  readonly groups = input<readonly LessonGroup[]>([]);
  /** The lesson to change; `null` plans a new one. */
  readonly lesson = input<ScheduledLesson | null>(null);
  /** Time of a new lesson. */
  readonly slot = input<LessonSlot | null>(null);
  readonly defaultDuration = input(60);
  /** A new lesson with this student only (the student's card): «with whom» is set and fixed. */
  readonly studentId = input<string | null>(null);
  /** A new lesson with this group only (the group's card): «with whom» is set and fixed. */
  readonly groupId = input<string | null>(null);
  readonly saved = output<ScheduledLesson>();

  protected readonly ownerOptions = computed(() => ownerOptions(this.students(), this.groups()));
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly overlap = signal(false);

  protected readonly repeats = [0, 1, 2, 3, 4].map((value) => ({
    value,
    label: T.lessonDialog.repeatChoice(value),
  }));
  protected readonly scopes = [
    { value: 'ONLY', label: T.lessonDialog.onlyThis },
    { value: 'FOLLOWING', label: T.lessonDialog.thisFollowing },
  ];
  protected readonly preview = signal<FollowingLessons | null>(null);
  readonly form = new FormGroup({
    repeatWeeks: new FormControl(0, { nonNullable: true }),
    repeatUntil: new FormControl<Date | null>(null),
    scope: new FormControl<RepeatScope>('ONLY', { nonNullable: true }),
    owner: new FormControl<OwnerValue | null>(null, [Validators.required]),
    startsAt: new FormControl<Date | null>(null, [Validators.required]),
    durationMinutes: new FormControl<number | null>(60, [
      Validators.required,
      Validators.min(1),
      Validators.max(600),
    ]),
    title: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    topic: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    meetingUrl: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000), Validators.pattern(MEETING_URL_PATTERN)],
    }),
  });

  protected readonly dirty = toSignal(this.form.valueChanges.pipe(map(() => this.form.dirty)), {
    initialValue: false,
  });
  protected readonly repeatWeeks = toSignal(this.form.controls.repeatWeeks.valueChanges, {
    initialValue: 0,
  });

  constructor() {
    this.form.controls.repeatWeeks.valueChanges.pipe(takeUntilDestroyed()).subscribe((weeks) => {
      const lesson = this.lesson();
      if (lesson?.seriesId && weeks !== lesson.repeatWeeks)
        this.form.controls.scope.setValue('FOLLOWING');
    });
    this.form.controls.scope.valueChanges.pipe(takeUntilDestroyed()).subscribe((scope) => {
      this.preview.set(null);
      const lesson = this.lesson();
      if (scope === 'FOLLOWING' && lesson?.seriesId) {
        this.api.following(lesson.id).subscribe({
          next: (preview) => {
            if (this.form.controls.scope.value === 'FOLLOWING' && this.lesson()?.id === lesson.id)
              this.preview.set(preview);
          },
          error: (error: unknown) => {
            this.error.set(describeError(error, T.lessonDialog.previewFailed));
          },
        });
      }
    });
    this.form.controls.repeatUntil.valueChanges.pipe(takeUntilDestroyed()).subscribe((until) => {
      const lesson = this.lesson();
      if (lesson?.seriesId && (until ? toIsoDate(until) : null) !== (lesson.repeatUntil ?? null)) {
        this.form.controls.scope.setValue('FOLLOWING');
      }
    });
    followDefaultTopic(
      this.form.controls.owner,
      this.form.controls.title,
      () => ({ students: this.students(), groups: this.groups() }),
      () => this.lesson() === null,
    );
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

  /** The default title of a lesson: the name of the chosen student or group. */
  protected ownerName(): string {
    const owner = this.form.controls.owner.value;
    return (
      this.ownerOptions()
        .flatMap((group) => group.items)
        .find((option) => option.value === owner)?.label ?? ''
    );
  }

  save(allowOverlap = false): void {
    const value = this.form.getRawValue();
    if (
      !revealErrors(this.form) ||
      this.pending() ||
      value.owner === null ||
      value.startsAt === null ||
      (value.scope === 'FOLLOWING' && !!this.lesson()?.seriesId && this.preview() === null)
    ) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.overlap.set(false);
    const details = {
      startsAt: value.startsAt.toISOString(),
      durationMinutes: value.durationMinutes ?? this.defaultDuration(),
      title: optionalText(value.title),
      topic: optionalText(value.topic),
      meetingUrl: optionalText(value.meetingUrl),
      allowOverlap,
      repeatWeeks: value.repeatWeeks,
      repeatUntil:
        value.repeatWeeks > 0 && value.repeatUntil !== null ? toIsoDate(value.repeatUntil) : null,
      scope: value.scope,
      version: this.lesson()?.version,
      repeatVersion: this.preview()?.repeatVersion ?? this.lesson()?.repeatVersion,
    };
    const lesson = this.lesson();
    const request =
      lesson === null
        ? this.api.plan({ ...ownerIds(value.owner), ...details })
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
          this.error.set(describeError(error, T.lessonDialog.failed));
        }
      },
    });
  }

  /** The owner a card fixes: its student or its group. */
  private preset(): OwnerValue | null {
    const studentId = this.studentId();
    const groupId = this.groupId();
    if (studentId !== null) {
      return `student:${studentId}`;
    }
    return groupId === null ? null : `group:${groupId}`;
  }

  private reset(): void {
    this.error.set(null);
    this.overlap.set(false);
    const lesson = this.lesson();
    const slot = this.slot();
    const preset = this.preset();
    this.form.reset({
      owner: lesson === null ? preset : ownerValue(lesson),
      startsAt: lesson === null ? (slot?.start ?? null) : new Date(lesson.startsAt),
      durationMinutes: lesson?.durationMinutes ?? slot?.durationMinutes ?? this.defaultDuration(),
      title:
        lesson === null
          ? defaultTopic(preset, { students: this.students(), groups: this.groups() })
          : (lesson.title ?? ''),
      topic: lesson?.topic ?? '',
      meetingUrl: lesson?.meetingUrl ?? '',
      repeatWeeks: lesson?.repeatWeeks ?? 0,
      repeatUntil: lesson?.repeatUntil ? new Date(lesson.repeatUntil + 'T00:00:00') : null,
      scope: 'ONLY',
    });
    if (lesson === null && preset === null) {
      this.form.controls.owner.enable();
    } else {
      this.form.controls.owner.disable();
    }
  }
}
