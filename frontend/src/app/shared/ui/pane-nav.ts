import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from 'primeng/badge';

/** An item of {@link PaneNav}: the section's key in the address, its icon, name and what it holds. */
export interface PaneNavItem {
  readonly id: string;
  /** The icon class, e.g. `tb-i-database`. */
  readonly icon: string;
  readonly title: string;
  readonly summary: string;
  /** A count next to the name (unsaved changes, problems); none or 0 — no badge. */
  readonly badge?: number;
}

/**
 * The list of a list-detail page (redesign spec §10.3): two-line M3 list items with a leading icon in a tonal
 * circle, linked to `<base>/<id>`; the chosen one is filled with secondary container.
 *
 * ```html
 * <tb-pane-nav [items]="items" base="/admin/settings" [current]="current().id" [label]="t.sections" />
 * ```
 */
@Component({
  selector: 'tb-pane-nav',
  imports: [RouterLink, Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="label()">
      <ul class="tb-pane-nav__list">
        @for (item of items(); track item.id) {
          <li>
            <a
              class="tb-pane-nav__item"
              [routerLink]="[base(), item.id]"
              [class.tb-pane-nav__current]="item.id === current()"
              [attr.aria-current]="item.id === current() ? 'page' : null"
            >
              <i class="tb-i tb-pane-nav__icon {{ item.icon }}" aria-hidden="true"></i>
              <span class="tb-pane-nav__text">
                <span class="tb-pane-nav__title">{{ item.title }}</span>
                <span class="tb-pane-nav__summary">{{ item.summary }}</span>
              </span>
              @if (item.badge) {
                <p-badge [value]="item.badge" />
              }
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    .tb-pane-nav__list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: var(--tb-space-4) 0 0;
      padding: 0;
      list-style: none;
    }

    .tb-pane-nav__item {
      display: flex;
      align-items: center;
      gap: var(--tb-space-4);
      min-block-size: 4.5rem;
      box-sizing: border-box;
      padding: var(--tb-space-2) var(--tb-space-4);
      border-radius: var(--tb-list-inner);
      background: var(--tb-list-item);
      color: var(--p-md-on-surface);

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface) var(--tb-state-hover),
          var(--tb-list-item)
        );
        text-decoration: none;
      }
    }

    /* the segmented list (M3E): the group's outer corners are large, the rows between are 4 px */
    li:first-child .tb-pane-nav__item {
      border-start-start-radius: var(--tb-list-outer);
      border-start-end-radius: var(--tb-list-outer);
    }

    li:last-child .tb-pane-nav__item {
      border-end-start-radius: var(--tb-list-outer);
      border-end-end-radius: var(--tb-list-outer);
    }

    .tb-pane-nav__icon {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font-size: 1.5rem;
    }

    .tb-pane-nav__text {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }

    .tb-pane-nav__title {
      font: var(--tb-type-title-m);
    }

    .tb-pane-nav__summary {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-pane-nav__current,
    .tb-pane-nav__current:hover {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);

      .tb-pane-nav__title {
        font: var(--tb-type-title-m-emphasized);
      }

      .tb-pane-nav__icon {
        background: var(--p-md-surface);
      }

      .tb-pane-nav__summary {
        color: inherit;
      }
    }
  `,
})
export class PaneNav {
  readonly items = input.required<readonly PaneNavItem[]>();
  /** The route of the page; an item leads to `<base>/<id>`. */
  readonly base = input.required<string>();
  /** The key of the chosen item; none while the detail is not shown. */
  readonly current = input<string | null>(null);
  /** The name of the navigation for assistive technology. */
  readonly label = input.required<string>();
}
