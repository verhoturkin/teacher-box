import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from 'primeng/api';

/**
 * The sections of the role on a wide screen (ADR-0017, ADR-0019, ADR-0024): the expanded
 * navigation rail with icons and labels in a row, or the narrow navigation rail with the label under
 * the icon. It is a list of links (not a menu): Tab goes through the sections, the current one is
 * `aria-current="page"` and has the pill indicator.
 */
@Component({
  selector: 'tb-side-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'navigation',
    'aria-label': 'Разделы',
    '[class.tb-side-nav--rail]': 'rail()',
  },
  template: `
    <ul class="tb-side-nav__list">
      @for (item of items(); track item.label) {
        <li>
          <a
            class="tb-side-nav__item"
            [routerLink]="item.routerLink"
            routerLinkActive="tb-side-nav__item--active"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="item.routerLinkActiveOptions ?? { exact: false }"
          >
            <span class="tb-side-nav__icon"><i [class]="item.icon" aria-hidden="true"></i></span>
            <span class="tb-side-nav__label">{{ item.label }}</span>
          </a>
        </li>
      }
    </ul>
  `,
  styleUrl: './side-nav.scss',
})
export class SideNav {
  readonly items = input.required<MenuItem[]>();
  /** The narrow rail instead of the expanded one. */
  readonly rail = input(false);
}
