import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { MoneyPipe } from '@shared/money/money.pipe';
import { MyBillingSummary } from '../data-access/billing.models';
import { BalanceAmount } from '../ledger/balance-amount';
import { T } from '../i18n/texts';

/** Student's home: balance, lesson price and the latest payment. */
@Component({
  selector: 'tb-my-balance-widget',
  imports: [DatePipe, RouterLink, Card, MoneyPipe, BalanceAmount],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let billing = summary();
    <p-card [header]="t.title">
      <div class="tb-stat">
        <span class="tb-stat__value"
          ><tb-balance-amount [balance]="billing.balance" [currency]="billing.currency"
        /></span>
        <small class="tb-muted">{{
          t.lessonPrice((billing.lessonPrice | money: billing.currency) ?? '')
        }}</small>
        @if (billing.lastPayment; as payment) {
          <small class="tb-muted">{{
            t.lastPayment(
              (payment.amount | money: billing.currency) ?? '',
              (payment.paidOn | date: 'dd.MM.yyyy') ?? ''
            )
          }}</small>
        }
      </div>
      <div class="tb-widget-footer">
        <span></span>
        <a routerLink="/cabinet/billing">{{ t.history }}</a>
      </div>
    </p-card>
  `,
})
export class MyBalanceWidget {
  protected readonly t = T.myBalance;
  readonly summary = input.required<MyBillingSummary>();
}
