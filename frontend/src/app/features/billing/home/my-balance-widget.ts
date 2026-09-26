import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { MoneyPipe } from '@shared/money/money.pipe';
import { MyBillingSummary } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';

/** Student's home: balance, lesson price and the latest payment. */
@Component({
  selector: 'tb-my-balance-widget',
  imports: [DatePipe, RouterLink, Card, MoneyPipe, BalanceAmount],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let billing = summary();
    <p-card header="Баланс">
      <div class="tb-stat">
        <span class="tb-stat__value"><tb-balance-amount [balance]="billing.balance" [currency]="billing.currency" /></span>
        <small class="tb-muted">Занятие стоит {{ billing.lessonPrice | money: billing.currency }}</small>
        @if (billing.lastPayment; as payment) {
          <small class="tb-muted">
            Последняя оплата: {{ payment.amount | money: billing.currency }}, {{ payment.paidOn | date: 'dd.MM.yyyy' }}
          </small>
        }
      </div>
      <div class="tb-widget-footer">
        <span></span>
        <a routerLink="/cabinet/billing">История оплат</a>
      </div>
    </p-card>
  `,
})
export class MyBalanceWidget {
  readonly summary = input.required<MyBillingSummary>();
}
