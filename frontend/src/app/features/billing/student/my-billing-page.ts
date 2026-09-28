import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { HelpButton } from '@features/help/parts';
import { MoneyPipe } from '@shared/money/money.pipe';
import { BillingApi } from '../data-access/billing-api';
import { StudentLedger } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { LedgerTable } from '../ledger/ledger-table';

/** Student: own balance and history of lessons and payments. */
@Component({
  selector: 'tb-my-billing-page',
  imports: [HelpButton, Card, MoneyPipe, BalanceAmount, LedgerTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-page-heading">
      <h1 class="tb-page-title">Оплаты</h1>
      <tb-help-button topic="cabinet/billing" />
    </div>
    @if (ledger(); as ledger) {
      <div class="tb-stats">
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Баланс</span>
            <span class="tb-stat__value"
              ><tb-balance-amount [balance]="ledger.balance" [currency]="ledger.currency"
            /></span>
            <small class="tb-muted">
              @if (ledger.balance < 0) {
                Столько нужно оплатить за прошедшие занятия.
              } @else if (ledger.balance > 0) {
                Эта сумма пойдёт в счёт следующих занятий.
              } @else {
                Всё оплачено.
              }
            </small>
          </div>
        </p-card>
        <p-card>
          <div class="tb-stat">
            <span class="tb-muted">Стоимость занятия</span>
            <span class="tb-stat__value">{{ ledger.lessonPrice | money: ledger.currency }}</span>
          </div>
        </p-card>
      </div>
      <p-card header="История">
        <tb-ledger-table [ledger]="ledger" />
      </p-card>
    }
  `,
})
export class MyBillingPage implements OnInit {
  private readonly api = inject(BillingApi);

  protected readonly ledger = signal<StudentLedger | null>(null);

  ngOnInit(): void {
    this.api.myLedger().subscribe((ledger) => {
      this.ledger.set(ledger);
    });
  }
}
