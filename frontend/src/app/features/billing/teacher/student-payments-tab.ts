import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { formatMoney } from '@shared/money/money';
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

/**
 * The Оплаты tab of a student's card (redesign spec §8): the balance, the totals, the lesson price (changed on
 * Профиль) and the history of lessons and payments with the teacher's corrections — cancelled charges,
 * voided payments, receipts. A payment is recorded from the card's «Оплата».
 */
@Component({
  selector: 'tb-student-payments-tab',
  imports: [Card, ConfirmDialog, MoneyPipe, BalanceAmount, LedgerList, LoadStateView],
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
          <!-- changed on the Профиль tab (redesign spec §8: one home per function) -->
          <div class="tb-stat">
            <span class="tb-muted">{{ t.lessonPrice }}</span>
            <span class="tb-stat__value">{{ ledger.lessonPrice | money: ledger.currency }}</span>
          </div>
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
      });
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
