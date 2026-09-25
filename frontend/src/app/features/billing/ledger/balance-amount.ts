import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MoneyPipe } from '@shared/money/money.pipe';

/** A balance with its meaning: debt (red), prepayment (green) or settled. */
@Component({
  selector: 'tb-balance-amount',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="cssClass()">
      @if (balance() < 0) {
        долг {{ -balance() | money: currency() }}
      } @else if (balance() > 0) {
        аванс {{ balance() | money: currency() }}
      } @else {
        0
      }
    </span>
  `,
})
export class BalanceAmount {
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
