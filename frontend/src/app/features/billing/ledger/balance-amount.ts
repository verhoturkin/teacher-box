import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MoneyPipe } from '@shared/money/money.pipe';
import { T } from '../i18n/texts';

/** A balance with its meaning: debt (red), prepayment (green) or settled. */
@Component({
  selector: 'tb-balance-amount',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="cssClass()">
      @if (balance() < 0) {
        {{ t.debt((-balance() | money: currency()) ?? '') }}
      } @else if (balance() > 0) {
        {{ t.prepaid((balance() | money: currency()) ?? '') }}
      } @else {
        {{ 0 | money: currency() }}
      }
    </span>
  `,
})
export class BalanceAmount {
  protected readonly t = T.balance;
  readonly balance = input.required<number>();
  readonly currency = input.required<string>();

  protected readonly cssClass = computed(() => {
    const balance = this.balance();
    if (balance < 0) {
      return 'tb-negative tb-strong';
    }
    return balance > 0 ? 'tb-positive' : 'tb-muted';
  });
}
