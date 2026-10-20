import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Card } from 'primeng/card';
import { MoneyPipe } from '@shared/money/money.pipe';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { BillingApi } from '../data-access/billing-api';
import { StudentLedger } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { LedgerEntry, ledgerEntries } from '../ledger/ledger-entries';
import { T } from '../i18n/texts';

/** How many of the last operations the card shows. */
const SHOWN = 3;

/**
 * Overview of a student's card (redesign spec §8): the balance, the lesson price and the last counted
 * operations — payments and charged lessons.
 */
@Component({
  selector: 'tb-student-balance-card',
  imports: [BalanceAmount, Card, DatePipe, LoadStateView, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (ledger(); as ledger) {
          <div class="tb-stat">
            <span class="tb-stat__value"
              ><tb-balance-amount [balance]="ledger.balance" [currency]="ledger.currency"
            /></span>
            <small class="tb-muted">{{
              t.lessonPrice((ledger.lessonPrice | money: ledger.currency) ?? '')
            }}</small>
          </div>
          @if (last().length > 0) {
            <ul
              class="tb-list tb-list--no-lead tb-student-balance__last"
              [attr.aria-label]="t.last"
            >
              @for (entry of last(); track entry.kind + entry.id) {
                <li>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{
                      entry.kind === 'payment' ? t.payment : t.lesson
                    }}</span>
                    <span class="tb-list__supporting">{{ entry.date | date: 'dd.MM.yyyy' }}</span>
                  </div>
                  <div class="tb-list__trail">
                    @if (entry.kind === 'payment') {
                      <span class="tb-positive"
                        >+{{ entry.payment.amount | money: ledger.currency }}</span
                      >
                    } @else {
                      <span>−{{ entry.lesson.price | money: ledger.currency }}</span>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        }
      </tb-load-state>
    </p-card>
  `,
  styles: `
    .tb-student-balance__last {
      margin-block-start: var(--tb-space-4);
    }
  `,
})
export class StudentBalanceCard {
  protected readonly t = T.studentBalance;
  private readonly api = inject(BillingApi);

  readonly studentId = input.required<string>();
  /** Changed by the card when it recorded a payment: the balance is read again. */
  readonly revision = input(0);

  protected readonly state = new LoadState();
  protected readonly ledger = signal<StudentLedger | null>(null);
  protected readonly last = computed<LedgerEntry[]>(() => {
    const ledger = this.ledger();
    return ledger === null
      ? []
      : ledgerEntries(ledger)
          .filter((entry) => !entry.inactive)
          .slice(0, SHOWN);
  });

  constructor() {
    effect(() => {
      this.revision();
      this.studentId();
      untracked(() => {
        this.load();
      });
    });
  }

  protected load(): void {
    this.api
      .ledger(this.studentId())
      .pipe(this.state.track())
      .subscribe((ledger) => {
        this.ledger.set(ledger);
      });
  }
}
