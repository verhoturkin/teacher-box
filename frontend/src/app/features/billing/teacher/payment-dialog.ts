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
import { toIsoDate } from '@shared/dates/iso-date';
import { toMinorUnits } from '@shared/money/money';
import { PAYMENT_METHOD_OPTIONS } from '../billing-labels';
import { BillingApi } from '../data-access/billing-api';
import { BillingStudent, Payment, PaymentMethod } from '../data-access/billing.models';

/** Registers a payment from a student. */
@Component({
  selector: 'tb-payment-dialog',
  imports: [ReactiveFormsModule, Button, DatePicker, Dialog, InputNumber, InputText, Message, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog header="Оплата" [(visible)]="visible" [modal]="true" [style]="{ width: '30rem' }" [draggable]="false">
      <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="payment-student">Ученик</label>
          <p-select
            inputId="payment-student"
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
            <label for="payment-amount">Сумма</label>
            <p-inputnumber inputId="payment-amount" formControlName="amount" mode="currency" [currency]="currency()" locale="ru-RU" [min]="0" [fluid]="true" />
          </div>
          <div class="tb-field">
            <label for="payment-date">Дата оплаты</label>
            <p-datepicker inputId="payment-date" formControlName="paidOn" dateFormat="dd.mm.yy" [showIcon]="true" [showOnFocus]="false" appendTo="body" [fluid]="true" />
          </div>
        </div>
        <div class="tb-field">
          <label for="payment-method">Способ</label>
          <p-select
            inputId="payment-method"
            formControlName="method"
            [options]="methodOptions"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-field">
          <label for="payment-comment">Комментарий</label>
          <input pInputText id="payment-comment" formControlName="comment" autocomplete="off" />
        </div>
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
export class PaymentDialog {
  private readonly api = inject(BillingApi);

  readonly visible = model(false);
  readonly students = input.required<readonly BillingStudent[]>();
  readonly studentId = input<string | null>(null);
  readonly currency = input.required<string>();
  readonly saved = output<Payment>();

  protected readonly methodOptions = PAYMENT_METHOD_OPTIONS;
  protected readonly studentOptions = computed(() =>
    this.students().map((student) => ({ label: student.displayName, value: student.studentId })),
  );
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    studentId: new FormControl<string | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    paidOn: new FormControl<Date>(new Date(), { nonNullable: true, validators: [Validators.required] }),
    method: new FormControl<PaymentMethod>('TRANSFER', { nonNullable: true }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.error.set(null);
        this.form.reset({
          studentId: this.studentId(),
          amount: null,
          paidOn: new Date(),
          method: 'TRANSFER',
          comment: '',
        });
      }
    });
  }

  save(): void {
    const value = this.form.getRawValue();
    if (this.form.invalid || this.pending() || value.studentId === null || value.amount === null) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api
      .recordPayment({
        studentId: value.studentId,
        amount: toMinorUnits(value.amount, this.currency()),
        paidOn: toIsoDate(value.paidOn),
        method: value.method,
        comment: value.comment.trim() === '' ? null : value.comment.trim(),
      })
      .subscribe({
        next: (payment) => {
          this.pending.set(false);
          this.visible.set(false);
          this.saved.emit(payment);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, 'Не удалось сохранить оплату'));
        },
      });
  }
}
