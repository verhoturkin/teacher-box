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
import { Card } from 'primeng/card';
import { formatMoney } from '@shared/money/money';
import { MoneyPipe } from '@shared/money/money.pipe';
import { BillingApi } from '../data-access/billing-api';
import { Lesson, Payment, StudentLedger } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { LedgerList } from '../ledger/ledger-list';
import { checkFiles } from '@shared/files/check-files';
import { RECEIPT_POLICY } from '../receipts';
import { describeError } from '@core/http/error-messages';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Confirm } from '@shared/ui/confirm';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';

/**
 * The Оплаты tab of a student's card (redesign spec §8): the balance, the totals, the lesson price (changed on
 * Профиль) and the history of lessons and payments with the teacher's corrections — cancelled charges,
 * voided payments, receipts. A payment is recorded from the card's «Оплата».
 */
@Component({
  selector: 'tb-student-payments-tab',
  imports: [Card, MoneyPipe, BalanceAmount, LedgerList, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    .tb-student-figures {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--tb-space-3);
      margin: 0 0 var(--tb-space-6);
      > div {
        display: flex;
        flex-direction: column;
        gap: var(--tb-space-1);
        min-width: 0;
        padding: var(--tb-space-4);
        border-radius: var(--tb-shape-lg);
        background: var(--tb-list-item);
      }
      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
    }
    @container (width < 40rem) {
      .tb-student-figures {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
  template: `
    @if (!state.ready()) {
      <tb-load-state [state]="state" [what]="t.what" (retry)="reload()" />
    } @else if (ledger(); as ledger) {
      <dl class="tb-student-figures">
        <div>
          <dt class="tb-figure__label">{{ t.balance }}</dt>
          <dd class="tb-figure__value">
            <tb-balance-amount [balance]="ledger.balance" [currency]="ledger.currency" />
          </dd>
        </div>
        <div>
          <dt class="tb-figure__label">{{ t.charged }}</dt>
          <dd class="tb-figure__value">{{ ledger.charged | money: ledger.currency }}</dd>
        </div>
        <div>
          <dt class="tb-figure__label">{{ t.paid }}</dt>
          <dd class="tb-figure__value">{{ ledger.paid | money: ledger.currency }}</dd>
        </div>
        <div>
          <dt class="tb-figure__label">{{ t.lessonPrice }}</dt>
          <dd class="tb-figure__value">{{ ledger.lessonPrice | money: ledger.currency }}</dd>
        </div>
      </dl>

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
  `,
})
export class StudentPaymentsTab {
  protected readonly t = T.studentLedger;
  private readonly api = inject(BillingApi);
  private readonly confirm = inject(Confirm);
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

  protected async confirmCancel(lesson: Lesson): Promise<void> {
    const ledger = this.ledger();
    if (
      await this.confirm.danger({
        header: T.studentLedger.cancelHeader,
        message: T.studentLedger.cancelMessage(
          ledger === null ? '' : formatMoney(lesson.price, ledger.currency),
        ),
        acceptLabel: T.studentLedger.cancelAccept,
      })
    ) {
      this.api.cancelLesson(lesson.id, null).subscribe(() => {
        this.corrected();
      });
    }
  }

  protected async attachReceipt(payment: Payment, file: File): Promise<void> {
    const { rejected } = await checkFiles([file], RECEIPT_POLICY);
    if (rejected[0] !== undefined) {
      this.snackbar.error(rejected[0].message);
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

  protected async confirmRemoveReceipt(payment: Payment): Promise<void> {
    if (
      await this.confirm.danger({
        header: T.studentLedger.removeReceiptHeader,
        message: T.studentLedger.removeReceiptMessage,
        acceptLabel: T.studentLedger.removeReceiptAccept,
      })
    ) {
      this.api.removeReceipt(payment.id).subscribe(() => {
        this.snackbar.success(T.studentLedger.receiptRemoved);
        this.reload();
      });
    }
  }

  protected async confirmVoid(payment: Payment): Promise<void> {
    const ledger = this.ledger();
    if (
      await this.confirm.danger({
        header: T.studentLedger.voidHeader,
        message: T.studentLedger.voidMessage(
          ledger === null ? '' : formatMoney(payment.amount, ledger.currency),
        ),
        acceptLabel: T.studentLedger.voidAccept,
      })
    ) {
      this.api.voidPayment(payment.id, null).subscribe(() => {
        this.corrected();
      });
    }
  }

  /** A charge cancelled or a payment voided: the balance changed. */
  private corrected(): void {
    this.reload();
    this.changed.emit();
  }
}
