import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tooltip } from 'primeng/tooltip';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputNumber } from 'primeng/inputnumber';
import { formatMoney, toMajorUnits, toMinorUnits } from '@shared/money/money';
import { MoneyPipe } from '@shared/money/money.pipe';
import { BillingApi } from '../data-access/billing-api';
import { Lesson, Payment, StudentLedger } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { LedgerList } from '../ledger/ledger-list';
import { RECEIPT_MAX_SIZE } from '../receipts';
import { describeError } from '@core/http/error-messages';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { locale } from '@core/i18n/language';

/**
 * The Оплаты tab of a student's card (redesign spec §8): the balance, the totals, the lesson price and the
 * history of lessons and payments with the teacher's corrections — cancelled charges, voided payments,
 * receipts. A payment is recorded from the card's «Оплата».
 */
@Component({
  selector: 'tb-student-payments-tab',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    ConfirmDialog,
    InputNumber,
    MoneyPipe,
    BalanceAmount,
    LedgerList,
    Tooltip,
    LoadStateView,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!state.ready()) {
      <tb-load-state [state]="state" [what]="t.what" (retry)="reload()" />
    } @else if (ledger(); as ledger) {
      <div class="tb-stats">
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">{{ t.balance }}</span>
            <span class="tb-stat__value"
              ><tb-balance-amount [balance]="ledger.balance" [currency]="ledger.currency"
            /></span>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">{{ t.charged }}</span>
            <span class="tb-stat__value">{{ ledger.charged | money: ledger.currency }}</span>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">{{ t.paid }}</span>
            <span class="tb-stat__value">{{ ledger.paid | money: ledger.currency }}</span>
          </div>
        </p-card>
        <p-card>
          @if (editingPrice()) {
            <!-- the field under its label across the card, the buttons under it (ADR-0018) -->
            <form class="tb-form" [formGroup]="priceForm" (ngSubmit)="savePrice()">
              <div class="tb-field">
                <label for="lesson-price-input">{{ t.lessonPrice }}</label>
                <p-inputnumber
                  inputId="lesson-price-input"
                  formControlName="price"
                  mode="currency"
                  currencyDisplay="narrowSymbol"
                  [currency]="ledger.currency"
                  [locale]="locale"
                  [min]="0"
                  [fluid]="true"
                />
              </div>
              <div class="tb-form-actions">
                <p-button
                  [label]="c.cancel"
                  severity="secondary"
                  [text]="true"
                  (onClick)="cancelPrice()"
                />
                <p-button
                  type="submit"
                  severity="secondary"
                  [label]="c.save"
                  icon="tb-i tb-i-check"
                  [disabled]="price.invalid || !priceChanged()"
                  [loading]="savingPrice()"
                />
              </div>
            </form>
          } @else {
            <div class="tb-stat">
              <span class="tb-muted">{{ t.lessonPrice }}</span>
              <span class="tb-stat__value">
                {{ ledger.lessonPrice | money: ledger.currency }}
                <p-button
                  icon="tb-i tb-i-edit"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  [pTooltip]="t.editPrice"
                  [ariaLabel]="t.editPrice"
                  (onClick)="editingPrice.set(true)"
                />
              </span>
            </div>
          }
        </p-card>
      </div>

      <p-card [header]="t.history">
        <tb-ledger-list
          [ledger]="ledger"
          [editable]="true"
          [receiptBusy]="receiptBusy()"
          (cancelLesson)="confirmCancel($event)"
          (voidPayment)="confirmVoid($event)"
          (attachReceipt)="attachReceipt($event.payment, $event.file)"
          (removeReceipt)="confirmRemoveReceipt($event)"
        />
      </p-card>
    }
    <p-confirmdialog />
  `,
})
export class StudentPaymentsTab {
  protected readonly locale = locale();
  protected readonly c = SHARED_T.common;
  protected readonly t = T.studentLedger;
  private readonly api = inject(BillingApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);
  /** The id of the payment whose receipt is being saved. */
  protected readonly receiptBusy = signal<string | null>(null);

  readonly studentId = input.required<string>();
  /** Changed by the card when it recorded a payment: the history is read again. */
  readonly revision = input(0);
  /** A correction changed the balance: the card's list reads the balances again. */
  readonly changed = output();

  protected readonly ledger = signal<StudentLedger | null>(null);
  protected readonly editingPrice = signal(false);
  readonly price = new FormControl<number | null>(null, [Validators.required, Validators.min(0)]);
  protected readonly priceForm = new FormGroup({ price: this.price });
  private readonly priceValue = toSignal(this.price.valueChanges, { initialValue: null });
  protected readonly priceChanged = computed(() => {
    const ledger = this.ledger();
    const value = this.priceValue();
    return (
      ledger !== null &&
      value !== null &&
      toMinorUnits(value, ledger.currency) !== ledger.lessonPrice
    );
  });

  protected readonly savingPrice = signal(false);
  protected readonly state = new LoadState();

  constructor() {
    effect(() => {
      this.revision();
      this.studentId();
      untracked(() => {
        this.reload();
      });
    });
  }

  reload(): void {
    this.api
      .ledger(this.studentId())
      .pipe(this.state.track())
      .subscribe((ledger) => {
        this.ledger.set(ledger);
        this.price.setValue(toMajorUnits(ledger.lessonPrice, ledger.currency));
      });
  }

  protected savePrice(): void {
    const ledger = this.ledger();
    const value = this.price.value;
    if (ledger === null || value === null || this.price.invalid || this.savingPrice()) {
      return;
    }
    this.savingPrice.set(true);
    this.api.changeLessonPrice(ledger.studentId, toMinorUnits(value, ledger.currency)).subscribe({
      next: (saved) => {
        this.savingPrice.set(false);
        this.ledger.set({ ...ledger, lessonPrice: saved });
        this.editingPrice.set(false);
        this.snackbar.success(T.studentLedger.priceChanged);
      },
      error: () => {
        this.savingPrice.set(false);
      },
    });
  }

  protected cancelPrice(): void {
    const ledger = this.ledger();
    if (ledger !== null) {
      this.price.setValue(toMajorUnits(ledger.lessonPrice, ledger.currency));
    }
    this.editingPrice.set(false);
  }

  protected confirmCancel(lesson: Lesson): void {
    const ledger = this.ledger();
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.studentLedger.cancelHeader,
        message: T.studentLedger.cancelMessage(
          ledger === null ? '' : formatMoney(lesson.price, ledger.currency),
        ),
        acceptLabel: T.studentLedger.cancelAccept,
        accept: () => {
          this.api.cancelLesson(lesson.id, null).subscribe(() => {
            this.corrected();
          });
        },
      }),
    );
  }

  protected attachReceipt(payment: Payment, file: File): void {
    if (file.size > RECEIPT_MAX_SIZE) {
      this.snackbar.error(T.studentLedger.receiptTooLarge);
      return;
    }
    this.receiptBusy.set(payment.id);
    this.api.attachReceipt(payment.id, file).subscribe({
      next: () => {
        this.receiptBusy.set(null);
        this.snackbar.success(T.studentLedger.receiptAttached);
        this.reload();
      },
      error: (error: unknown) => {
        this.receiptBusy.set(null);
        this.snackbar.error(describeError(error, T.studentLedger.receiptFailed));
      },
    });
  }

  protected confirmRemoveReceipt(payment: Payment): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.studentLedger.removeReceiptHeader,
        message: T.studentLedger.removeReceiptMessage,
        acceptLabel: T.studentLedger.removeReceiptAccept,
        accept: () => {
          this.api.removeReceipt(payment.id).subscribe(() => {
            this.snackbar.success(T.studentLedger.receiptRemoved);
            this.reload();
          });
        },
      }),
    );
  }

  protected confirmVoid(payment: Payment): void {
    const ledger = this.ledger();
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.studentLedger.voidHeader,
        message: T.studentLedger.voidMessage(
          ledger === null ? '' : formatMoney(payment.amount, ledger.currency),
        ),
        acceptLabel: T.studentLedger.voidAccept,
        accept: () => {
          this.api.voidPayment(payment.id, null).subscribe(() => {
            this.corrected();
          });
        },
      }),
    );
  }

  /** A charge cancelled or a payment voided: the balance changed. */
  private corrected(): void {
    this.reload();
    this.changed.emit();
  }
}
