import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';

/**
 * The sections of the role on a wide screen (ADR-0017, ADR-0019): the expanded navigation rail with
 * icons and labels in a row, or the narrow navigation rail with the label under the icon. The
 * active section has the pill indicator.
 */
@Component({
  selector: 'tb-side-nav',
  imports: [Menu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'navigation',
    'aria-label': 'Разделы',
    '[class.tb-side-nav--rail]': 'rail()',
  },
  template: `<p-menu [model]="items()" styleClass="tb-side-nav__menu" />`,
  styleUrl: './side-nav.scss',
})
export class SideNav {
  readonly items = input.required<MenuItem[]>();
  /** The narrow rail instead of the expanded one. */
  readonly rail = input(false);
}
