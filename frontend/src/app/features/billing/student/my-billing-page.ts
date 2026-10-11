import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { HelpButton } from '@features/help/parts';
import { MoneyPipe } from '@shared/money/money.pipe';
import { BillingApi } from '../data-access/billing-api';
import { StudentLedger } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { LedgerList } from '../ledger/ledger-list';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { T } from '../i18n/texts';

/** Student: own balance and history of lessons and payments. */
@Component({
  selector: 'tb-my-billing-page',
  imports: [HelpButton, Card, MoneyPipe, BalanceAmount, LedgerList, LoadStateView, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="cabinet/billing" />
    </tb-page-header>
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (ledger(); as ledger) {
        <div class="tb-stats">
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">{{ t.balance }}</span>
              <span class="tb-stat__value"
                ><tb-balance-amount [balance]="ledger.balance" [currency]="ledger.currency"
              /></span>
              <small class="tb-muted">
                @if (ledger.balance < 0) {
                  {{ t.toPay }}
                } @else if (ledger.balance > 0) {
                  {{ t.prepaid }}
                } @else {
                  {{ t.settled }}
                }
              </small>
            </div>
          </p-card>
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">{{ t.lessonPrice }}</span>
              <span class="tb-stat__value">{{ ledger.lessonPrice | money: ledger.currency }}</span>
            </div>
          </p-card>
        </div>
        <p-card [header]="t.history">
          <tb-ledger-list [ledger]="ledger" />
        </p-card>
      }
    </tb-load-state>
  `,
})
export class MyBillingPage implements OnInit {
  protected readonly t = T.myBilling;
  private readonly api = inject(BillingApi);

  protected readonly ledger = signal<StudentLedger | null>(null);
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .myLedger()
      .pipe(this.state.track())
      .subscribe((ledger) => {
        this.ledger.set(ledger);
      });
  }
}
