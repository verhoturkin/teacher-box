import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FabMenu, FabMenuItem } from '@shared/ui/fab-menu';

/**
 * §8 FAB menu `tb-fab-menu`: up to six actions. `variant="phone"` stands fixed above the bottom bar, so the
 * gallery shows the rail variants: `rail` (the FAB) and `extended` (icon + label).
 */
@Component({
  selector: 'tb-gallery-fab',
  imports: [FabMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      <li class="tb-gallery-cell">
        <tb-fab-menu label="Create" variant="rail" [items]="items" />
        <code class="tb-gallery-name">tb-fab-menu variant="rail"</code>
      </li>
      <li class="tb-gallery-cell">
        <tb-fab-menu label="Create" variant="extended" [items]="items" />
        <code class="tb-gallery-name">tb-fab-menu variant="extended"</code>
      </li>
    </ul>
  `,
})
export class FabSample {
  protected readonly items: readonly FabMenuItem[] = [
    { label: 'Lesson', icon: 'tb-i-calendar_add_on', run: () => undefined },
    { label: 'Assignment', icon: 'tb-i-assignment', run: () => undefined },
    { label: 'Payment', icon: 'tb-i-account_balance_wallet', run: () => undefined },
  ];
}
