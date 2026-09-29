import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { MoneyPipe } from '@shared/money/money.pipe';
import { InitialsPipe } from '@shared/ui/initials';
import { BillingSummary } from '../data-access/billing.models';

const MONTH = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' });

/** Teacher's home: debts and the income of the month. */
@Component({
  selector: 'tb-finance-widget',
  imports: [RouterLink, Card, InitialsPipe, MoneyPipe],
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
        <ul class="tb-list tb-debtors">
          @for (debtor of finance.topDebtors; track debtor.studentId) {
            <li>
              <span class="tb-avatar" aria-hidden="true">{{ debtor.displayName | initials }}</span>
              <div class="tb-list__text">
                <a
                  [routerLink]="['/teacher/billing/students', debtor.studentId]"
                  class="tb-list__title tb-link"
                  >{{ debtor.displayName }}</a
                >
                <span class="tb-list__supporting">долг</span>
              </div>
              <span class="tb-list__trail tb-negative">{{
                -debtor.balance | money: finance.currency
              }}</span>
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
    /* one figure under another (ADR-0021): the name on the left, the sum on the right */
    .tb-finance {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);

      .tb-stat {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: baseline;
        column-gap: var(--tb-space-4);

        > :first-child {
          font: var(--tb-type-body-l);
        }

        > small {
          grid-column: 1 / -1;
        }
      }
    }

    .tb-debtors {
      margin-top: var(--tb-space-4);
    }
  `,
})
export class FinanceWidget {
  readonly summary = input.required<BillingSummary>();

  /** Name of the month, e.g. «сентябрь». */
  protected readonly monthName = computed(() =>
    MONTH.format(new Date(`${this.summary().month}-01T00:00:00Z`)),
  );
}
