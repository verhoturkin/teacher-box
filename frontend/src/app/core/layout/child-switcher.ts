import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { Family, FamilyChild, firstName } from '@core/family/family';
import { CORE_T } from '@core/i18n/texts';
import { Avatar } from '@shared/ui/avatar';
import { injectUrl } from './nav-item';

const T = CORE_T.family;

/**
 * The address of the same section for another child: `/family/<a>/homework/<task>` →
 * `/family/<b>/homework` (a task, a lesson belong to the child they were opened for).
 */
export function childAddress(url: string, childId: string): string {
  const [, family, , section] = (url.split(/[?#]/)[0] ?? '').split('/');
  return family === 'family' && section !== undefined && section !== ''
    ? `/family/${childId}/${section}`
    : `/family/${childId}`;
}

/**
 * The child switcher of the family cabinet (453.2) in the top bar: a single-select set of chips with
 * the child's avatar, the choice is the address (`/family/:studentId/...`). One child — no switcher.
 *
 * From M3: a chip is 32 dp high with 8 dp corners and `label large`; a leading avatar is 24 dp (input
 * chip: 4 dp before it, 8 dp after it); unselected — 1 dp `outline variant`, `on surface variant`;
 * selected — `secondary container` without the outline. *Our decision:* the avatar takes the place of the
 * selected chip's check (the colour tells the children apart); on compact the top bar has no room for
 * the set, so one chip of the current child opens a menu of all the children (M3: a filter chip
 * combined with a menu).
 */
@Component({
  selector: 'tb-child-switcher',
  imports: [Avatar, Menu, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-child-switcher' },
  template: `
    @if (children().length > 1) {
      @if (compact()) {
        @if (family.child(); as current) {
          <button
            type="button"
            class="tb-child-chip tb-child-chip--selected tb-child-chip--menu"
            aria-haspopup="menu"
            [attr.aria-label]="t.switchFrom(current.displayName)"
            (click)="menu.toggle($event)"
          >
            <tb-avatar
              [name]="current.displayName"
              [photo]="current.avatar"
              size="1.5rem"
              [attr.data-tb-label]="family.label(current.id)"
            />
            <span>{{ first(current) }}</span>
            <i class="tb-i tb-i-arrow_drop_down" aria-hidden="true"></i>
          </button>
          <p-menu #menu [model]="items()" [popup]="true" appendTo="body" />
        }
      } @else {
        <nav class="tb-child-switcher__set" [attr.aria-label]="t.children">
          @for (child of children(); track child.id) {
            <a
              class="tb-child-chip"
              [class.tb-child-chip--selected]="child.id === family.current()"
              [routerLink]="address(child)"
              [attr.aria-current]="child.id === family.current() ? 'page' : null"
            >
              <tb-avatar
                [name]="child.displayName"
                [photo]="child.avatar"
                size="1.5rem"
                [attr.data-tb-label]="family.label(child.id)"
              />
              <span>{{ first(child) }}</span>
            </a>
          }
        </nav>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      min-inline-size: 0;
    }

    .tb-child-switcher__set {
      display: flex;
      gap: var(--tb-space-2);
      overflow: clip;
      overflow-clip-margin: 0.5rem;
    }

    .tb-child-chip {
      position: relative;
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: var(--tb-space-2);
      block-size: 2rem;
      box-sizing: border-box;
      padding-inline: var(--tb-space-1) var(--tb-space-4);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-sm);
      background: transparent;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
      text-decoration: none;
      cursor: pointer;
      transition: background var(--tb-spring-fast-effects);

      /* the 48 dp target (M3) */
      &::before {
        content: '';
        position: absolute;
        /* spacing-ok: touch-target inset (M3 minimum target) */
        inset: -0.5rem 0;
      }

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface-variant) var(--tb-state-hover),
          transparent
        );
      }

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }

      > .tb-i {
        font-size: 1.125rem;
      }
    }

    .tb-child-chip--selected {
      border-color: transparent;
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font: var(--tb-type-label-l-emphasized);

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-secondary-container) var(--tb-state-hover),
          var(--p-md-secondary-container)
        );
      }
    }

    .tb-child-chip--menu {
      padding-inline-end: var(--tb-space-2);
    }
  `,
})
export class ChildSwitcher {
  protected readonly t = T;
  protected readonly family = inject(Family);
  private readonly router = inject(Router);
  private readonly url = injectUrl();
  /** The top bar of a phone: one chip with a menu. */
  readonly compact = input(false);

  protected readonly children = this.family.children;
  protected readonly items = computed<MenuItem[]>(() =>
    this.children().map((child) => ({
      label: child.displayName,
      icon: child.id === this.family.current() ? 'tb-i tb-i-check' : undefined,
      command: () => {
        void this.router.navigateByUrl(this.address(child));
      },
    })),
  );

  protected first(child: FamilyChild): string {
    return firstName(child.displayName);
  }

  protected address(child: FamilyChild): string {
    return childAddress(this.url(), child.id);
  }
}
