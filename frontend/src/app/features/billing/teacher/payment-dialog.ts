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
import { Observable, catchError, of, switchMap } from 'rxjs';
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
import { Snackbar } from '@core/snackbar/snackbar';
import { BillingApi } from '../data-access/billing-api';
import { RECEIPT_ACCEPT, RECEIPT_MAX_SIZE } from '../receipts';
import { BillingStudent, Payment } from '../data-access/billing.models';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { locale } from '@core/i18n/language';

/** Registers a payment from a student. */
@Component({
  selector: 'tb-payment-dialog',
  imports: [
    ReactiveFormsModule,
    Button,
    DatePicker,
    Dialog,
    InputNumber,
    InputText,
    Message,
    Select,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="t.title"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <form tbFieldErrors id="payment-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field">
          <label for="payment-student">{{ t.student }}</label>
          <p-select
            inputId="payment-student"
            formControlName="studentId"
            [options]="studentOptions()"
            optionLabel="label"
            optionValue="value"
            [placeholder]="t.chooseStudent"
            [filter]="true"
            [filterPlaceholder]="t.search"
            [ariaFilterLabel]="t.search"
            appendTo="body"
            [fluid]="true"
          />
        </div>
        <div class="tb-row">
          <div class="tb-field">
            <label for="payment-amount">{{ t.amount }}</label>
            <p-inputnumber
              inputId="payment-amount"
              formControlName="amount"
              mode="currency"
              currencyDisplay="narrowSymbol"
              [currency]="currency()"
              [locale]="locale"
              [min]="0"
              [fluid]="true"
            />
          </div>
          <div class="tb-field">
            <label for="payment-date">{{ t.date }}</label>
            <p-datepicker
              inputId="payment-date"
              formControlName="paidOn"
              dateFormat="dd.mm.yy"
              [showIcon]="true"
              [showOnFocus]="false"
              appendTo="body"
              [fluid]="true"
            />
          </div>
        </div>
        <div class="tb-field">
          <label for="payment-comment">{{ t.comment }}</label>
          <input pInputText id="payment-comment" formControlName="comment" autocomplete="off" />
        </div>
        <div class="tb-field">
          <span id="payment-receipt-label">{{ t.receipt }}</span>
          <input
            #picker
            type="file"
            class="tb-sr-only"
            [accept]="receiptAccept"
            aria-labelledby="payment-receipt-label"
            (change)="onPicked(picker)"
          />
          <div class="tb-receipt-file">
            <p-button
              [label]="receipt() === null ? t.chooseReceipt : t.otherReceipt"
              icon="pi pi-paperclip"
              severity="secondary"
              (onClick)="picker.click()"
            />
            @if (receipt(); as chosen) {
              <span class="tb-receipt-file__name">{{ chosen.name }}</span>
              <p-button
                [label]="t.clearReceipt"
                severity="secondary"
                [text]="true"
                (onClick)="receipt.set(null)"
              />
            }
          </div>
          <small class="tb-hint">{{ t.receiptHint }}</small>
          @if (receiptError(); as message) {
            <small class="tb-field__error" role="alert">{{ message }}</small>
          }
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
          severity="success"
          [label]="c.save"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="payment-form"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .tb-receipt-file {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-receipt-file__name {
      min-width: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class PaymentDialog {
  protected readonly locale = locale();
  protected readonly c = SHARED_T.common;
  protected readonly t = T.paymentDialog;
  private readonly api = inject(BillingApi);
  private readonly snackbar = inject(Snackbar);
  protected readonly receiptAccept = RECEIPT_ACCEPT;
  /** The receipt to attach once the payment is recorded. */
  readonly receipt = signal<File | null>(null);
  protected readonly receiptError = signal<string | null>(null);

  readonly visible = model(false);
  readonly students = input.required<readonly BillingStudent[]>();
  readonly studentId = input<string | null>(null);
  readonly currency = input.required<string>();
  readonly saved = output<Payment>();

  protected readonly studentOptions = computed(() =>
    this.students().map((student) => ({ label: student.displayName, value: student.studentId })),
  );
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    studentId: new FormControl<string | null>(null, [Validators.required]),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    paidOn: new FormControl<Date>(new Date(), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  constructor() {
    // Opening resets the form. Untracked: the student list reads its own signals while the value is
    // written, and choosing a student would reset the form again.
    effect(() => {
      const studentId = this.studentId();
      if (this.visible()) {
        untracked(() => {
          this.error.set(null);
          this.receipt.set(null);
          this.receiptError.set(null);
          this.form.reset({ studentId, amount: null, paidOn: new Date(), comment: '' });
        });
      }
    });
  }

  protected onPicked(element: HTMLInputElement): void {
    const file = element.files?.[0] ?? null;
    element.value = '';
    if (file === null) {
      return;
    }
    if (file.size > RECEIPT_MAX_SIZE) {
      this.receiptError.set(T.paymentDialog.receiptTooLarge);
      return;
    }
    this.receiptError.set(null);
    this.receipt.set(file);
  }

  /** The recorded payment with its receipt; a receipt that fails leaves the payment recorded. */
  private withReceipt(payment: Payment): Observable<Payment> {
    const file = this.receipt();
    if (file === null) {
      return of(payment);
    }
    return this.api.attachReceipt(payment.id, file).pipe(
      catchError(() => {
        this.snackbar.error(T.paymentDialog.receiptFailed);
        return of(payment);
      }),
    );
  }

  save(): void {
    const value = this.form.getRawValue();
    if (
      !revealErrors(this.form) ||
      this.pending() ||
      value.studentId === null ||
      value.amount === null
    ) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api
      .recordPayment({
        studentId: value.studentId,
        amount: toMinorUnits(value.amount, this.currency()),
        paidOn: toIsoDate(value.paidOn),
        comment: value.comment.trim() === '' ? null : value.comment.trim(),
      })
      .pipe(switchMap((payment) => this.withReceipt(payment)))
      .subscribe({
        next: (payment) => {
          this.pending.set(false);
          this.visible.set(false);
          this.saved.emit(payment);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.paymentDialog.failed));
        },
      });
  }
}
