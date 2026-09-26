import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { MoneyPipe } from '@shared/money/money.pipe';
import { BillingSummary } from '../data-access/billing.models';

const MONTH = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' });

/** Teacher's home: debts and the income of the month. */
@Component({
  selector: 'tb-finance-widget',
  imports: [RouterLink, Card, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let finance = summary();
    <p-card header="Финансы">
      <div class="tb-finance">
        <div class="tb-stat">
          <span class="tb-muted">Поступило за {{ monthName() }}</span>
          <span class="tb-stat__value">{{ finance.income | money: finance.currency }}</span>
        </div>
        <div class="tb-stat">
          <span class="tb-muted">Долг учеников</span>
          <span class="tb-stat__value" [class.tb-negative]="finance.totalDebt > 0">
            {{ finance.totalDebt | money: finance.currency }}
          </span>
          @if (finance.debtors > 0) {
            <small class="tb-muted">должников: {{ finance.debtors }}</small>
          }
        </div>
      </div>
      @if (finance.topDebtors.length > 0) {
        <ul class="tb-debtors">
          @for (debtor of finance.topDebtors; track debtor.studentId) {
            <li>
              <a [routerLink]="['/teacher/billing/students', debtor.studentId]" class="tb-link">{{ debtor.displayName }}</a>
              <span class="tb-negative">{{ -debtor.balance | money: finance.currency }}</span>
            </li>
          }
        </ul>
      }
      <div class="tb-widget-footer">
        <span></span>
        <a routerLink="/teacher/billing">Оплаты</a>
      </div>
    </p-card>
  `,
  styles: `
    .tb-finance {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
    }

    .tb-debtors {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      margin: 1rem 0 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
      }
    }
  `,
})
export class FinanceWidget {
  readonly summary = input.required<BillingSummary>();

  /** Name of the month, e.g. «сентябрь». */
  protected readonly monthName = computed(() => MONTH.format(new Date(`${this.summary().month}-01T00:00:00Z`)));
}
