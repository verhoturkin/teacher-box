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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { toIsoDate } from '@shared/dates/iso-date';
import { toMajorUnits, toMinorUnits } from '@shared/money/money';
import { CHARGED_STATUS_OPTIONS } from '../billing-labels';
import { BillingApi } from '../data-access/billing-api';
import { BillingStudent, Lesson, LessonStatus } from '../data-access/billing.models';

type ChargedStatus = Exclude<LessonStatus, 'CANCELLED'>;

/** Records a conducted (or missed) lesson; the price defaults to the student's lesson price. */
@Component({
  selector: 'tb-lesson-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    DatePicker,
    Dialog,
    InputNumber,
    InputText,
    Message,
    Select,
    SelectButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog header="Занятие" [(visible)]="visible" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false">
      <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="lesson-student">Ученик</label>
          <p-select
            inputId="lesson-student"
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
          <label for="lesson-date">Дата</label>
          <p-datepicker inputId="lesson-date" formControlName="date" dateFormat="dd.mm.yy" [showIcon]="true" [showOnFocus]="false" appendTo="body" [fluid]="true" />
        </div>
        <div class="tb-field">
          <span id="lesson-status-label">Итог</span>
          <p-selectbutton
            formControlName="status"
            [options]="statusOptions"
            optionLabel="label"
            optionValue="value"
            ariaLabelledBy="lesson-status-label"
          />
        </div>
        <div class="tb-row">
          <div class="tb-field">
            <label for="lesson-duration">Длительность, мин</label>
            <p-inputnumber inputId="lesson-duration" formControlName="durationMinutes" [min]="1" [max]="600" [showButtons]="true" [step]="15" [fluid]="true" />
          </div>
          <div class="tb-field">
            <label for="lesson-price">Стоимость</label>
            <p-inputnumber inputId="lesson-price" formControlName="price" mode="currency" [currency]="currency()" locale="ru-RU" [min]="0" [fluid]="true" />
          </div>
        </div>
        <div class="tb-field">
          <label for="lesson-topic">Тема</label>
          <input pInputText id="lesson-topic" formControlName="topic" autocomplete="off" />
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button label="Отмена" severity="secondary" [text]="true" (onClick)="visible.set(false)" />
        <p-button label="Записать" [loading]="pending()" [disabled]="form.invalid" (onClick)="save()" />
      </ng-template>
    </p-dialog>
  `,
})
export class LessonDialog {
  private readonly api = inject(BillingApi);

  readonly visible = model(false);
  readonly students = input.required<readonly BillingStudent[]>();
  /** Preselected student. */
  readonly studentId = input<string | null>(null);
  readonly currency = input.required<string>();
  readonly defaultDuration = input(60);
  readonly saved = output<Lesson>();

  protected readonly statusOptions = CHARGED_STATUS_OPTIONS;
  protected readonly studentOptions = computed(() =>
    this.students().map((student) => ({ label: student.displayName, value: student.studentId })),
  );
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    studentId: new FormControl<string | null>(null, [Validators.required]),
    date: new FormControl<Date>(new Date(), { nonNullable: true, validators: [Validators.required] }),
    status: new FormControl<ChargedStatus>('CONDUCTED', { nonNullable: true }),
    durationMinutes: new FormControl<number | null>(60, [
      Validators.required,
      Validators.min(1),
      Validators.max(600),
    ]),
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    topic: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.error.set(null);
        this.form.reset({
          studentId: this.studentId(),
          date: new Date(),
          status: 'CONDUCTED',
          durationMinutes: this.defaultDuration(),
          price: this.priceOf(this.studentId()),
          topic: '',
        });
      }
    });
    // The price follows the selected student.
    this.form.controls.studentId.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((id) => {
      this.form.controls.price.setValue(this.priceOf(id));
    });
  }

  save(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || this.pending() || value.studentId === null || value.price === null) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api
      .recordLesson({
        studentId: value.studentId,
        date: toIsoDate(value.date),
        status: value.status,
        durationMinutes: value.durationMinutes ?? this.defaultDuration(),
        price: toMinorUnits(value.price, this.currency()),
        topic: value.topic.trim() === '' ? null : value.topic.trim(),
      })
      .subscribe({
        next: (lesson) => {
          this.pending.set(false);
          this.visible.set(false);
          this.saved.emit(lesson);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, 'Не удалось записать занятие'));
        },
      });
  }

  private priceOf(studentId: string | null): number | null {
    const student = this.students().find((candidate) => candidate.studentId === studentId);
    return student === undefined ? null : toMajorUnits(student.lessonPrice, this.currency());
  }
}
