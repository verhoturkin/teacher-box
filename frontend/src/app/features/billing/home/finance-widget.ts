import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Card } from 'primeng/card';
import { locale } from '@core/i18n/language';
import { MoneyPipe } from '@shared/money/money.pipe';
import { BillingSummary } from '../data-access/billing.models';
import { T } from '../i18n/texts';

const MONTH = new Intl.DateTimeFormat(locale(), { month: 'long', timeZone: 'UTC' });

/**
 * Teacher's home, the month (spec §6, the sketches): the title is the month, then one tonal block — «Поступило»
 * with the sum large and under it «Долг» (the debtors in the queue have their own rows).
 */
@Component({
  selector: 'tb-finance-widget',
  imports: [Card, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let finance = summary();
    <p-card [header]="monthName()">
      <div class="tb-figures">
        <div class="tb-figure tb-figure--wide">
          <span class="tb-figure__label">{{ t.income }}</span>
          <span class="tb-figure__value">{{ finance.income | money: finance.currency }}</span>
        </div>
        <div class="tb-figure">
          <span class="tb-figure__label">{{ t.totalDebt }}</span>
          <span class="tb-figure__value" [class.tb-negative]="finance.totalDebt > 0">{{
            finance.totalDebt | money: finance.currency
          }}</span>
          @if (finance.debtors > 0) {
            <small class="tb-muted">{{ t.debtors(finance.debtors) }}</small>
          }
        </div>
      </div>
    </p-card>
  `,
})
export class FinanceWidget {
  protected readonly t = T.finance;
  readonly summary = input.required<BillingSummary>();

  /** The month as the title: «Октябрь». */
  protected readonly monthName = computed(() => {
    const name = MONTH.format(new Date(`${this.summary().month}-01T00:00:00Z`));
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}
