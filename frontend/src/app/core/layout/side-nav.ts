import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CORE_T } from '@core/i18n/texts';
import { Portal } from '@core/portal/portal';
import { PortalLogo } from '@core/portal/portal-logo';
import { NavBadge } from './nav-badge';
import { NavItem, injectUrl, isNavActive } from './nav-item';

/**
 * The sections of the role from medium (ADR-0017, ADR-0019, ADR-0024): the expanded navigation rail
 * with icons and labels in a row from extra-large, the collapsed rail with the label under the icon
 * below it (ADR-0048, D5). Top to bottom (spec §3.2): the brand (the portal's logo and name, not a
 * button — M3 warns against logos mistaken for actions), the projected main action (the teacher's «Создать»,
 * `tb-create-menu`), the sections, a spacer, the bottom group
 * (Настройки, Справка). It is a list of links (not a menu): Tab goes through the sections, the current
 * one is `aria-current="page"` and has the pill indicator. On compact the shell opens it as the modal
 * expanded rail from ☰ (`modal`), with the sections that are not in the bottom bar.
 */
@Component({
  selector: 'tb-side-nav',
  imports: [RouterLink, PortalLogo, NavBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'navigation',
    '[attr.aria-label]': 'sections',
    '[class.tb-side-nav--rail]': 'rail()',
    '[class.tb-side-nav--modal]': 'modal()',
  },
  template: `
    <div class="tb-side-nav__brand">
      <tb-portal-logo [size]="rail() ? '2.5rem' : '1.75rem'" round />
      <!-- the 96 px rail shows the logo alone; the name stays for screen readers -->
      <span class="tb-side-nav__brand-name" [class.tb-sr-only]="rail()">{{ portalName() }}</span>
    </div>
    <!-- the main action of the area under the brand: the teacher's «Создать» (ADR-0048) -->
    <ng-content />
    @for (group of groups(); track group.footer) {
      <ul class="tb-side-nav__list" [class.tb-side-nav__footer]="group.footer">
        @for (item of group.items; track item.label) {
          <li>
            <a
              class="tb-side-nav__item"
              [routerLink]="item.routerLink"
              [class.tb-side-nav__item--active]="isActive(item)"
              [attr.aria-current]="isActive(item) ? 'page' : null"
              (click)="navigate.emit()"
            >
              <span class="tb-side-nav__indicator">
                <span class="tb-side-nav__icon"
                  ><i [class]="item.icon" aria-hidden="true"></i
                ></span>
                <span class="tb-side-nav__label">{{ item.label }}</span>
                @if (item.count; as badge) {
                  @if (badge() > 0) {
                    <tb-nav-badge [count]="badge()" [inline]="!rail()" />
                    @if (item.countLabel; as label) {
                      <span class="tb-sr-only">{{ label(badge()) }}</span>
                    }
                  }
                }
              </span>
            </a>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './side-nav.scss',
})
export class SideNav {
  readonly items = input.required<NavItem[]>();
  /** The bottom group after the spacer: the settings and the help of the area. */
  readonly footer = input<NavItem[]>([]);
  /** The narrow rail instead of the expanded one. */
  readonly rail = input(false);
  /** The modal expanded rail under ☰ on compact: it fills its sheet instead of standing by the page. */
  readonly modal = input(false);
  /** A destination is chosen (the modal rail closes). */
  readonly navigate = output();

  protected readonly sections = CORE_T.nav.sections;
  protected readonly portalName = inject(Portal).name;
  /** The sections, then the bottom group, each when it has links. */
  protected readonly groups = computed(() =>
    [
      { footer: false, items: this.items() },
      { footer: true, items: this.footer() },
    ].filter((group) => group.items.length > 0),
  );
  private readonly url = injectUrl();

  /** The destination of the current page (`isNavActive`). */
  protected isActive(item: NavItem): boolean {
    return isNavActive(item, this.url());
  }
}
