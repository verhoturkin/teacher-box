import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** One chip of {@link FilterChips}: its value, its label and, when it matters, the number it finds. */
export interface FilterChip<T extends string> {
  readonly value: T;
  readonly label: string;
  /** How many items the chip finds («Должники 2»); none — no number. */
  readonly count?: number;
}

/**
 * A single-select set of M3 filter chips over a list (M3: an alternative to segmented buttons when viewing
 * a list): choosing a chip unselects the others. M3 filter chip: 32 dp high, 8 dp corners, 1 dp
 * `outline variant` and `on surface variant` label unselected; `secondary container` without the outline and
 * a leading 18 dp check selected; label `label large`. *Our decision:* the set wraps (no horizontal
 * scroll), 8 dp between chips, a 48 dp target over each chip.
 *
 * ```html
 * <tb-filter-chips [label]="t.filters" [chips]="chips()" [(value)]="filter" />
 * ```
 */
@Component({
  selector: 'tb-filter-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-filter-chips', role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    @for (chip of chips(); track chip.value) {
      <button
        type="button"
        class="tb-filter-chip"
        [class.tb-filter-chip--selected]="chip.value === value()"
        [attr.aria-pressed]="chip.value === value()"
        (click)="value.set(chip.value)"
      >
        @if (chip.value === value()) {
          <i class="tb-i tb-i-check" aria-hidden="true"></i>
        }
        <span>{{ chip.label }}</span>
        @if (chip.count) {
          <span class="tb-filter-chip__count">{{ chip.count }}</span>
        }
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-filter-chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
      block-size: 2rem;
      box-sizing: border-box;
      padding: 0 var(--tb-space-4);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-sm);
      background: transparent;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
      cursor: pointer;
      transition: background var(--tb-spring-fast-effects);

      /* the 48 dp target (M3) */
      &::before {
        content: '';
        position: absolute;
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

    .tb-filter-chip--selected {
      padding-inline-start: var(--tb-space-2);
      border-color: transparent;
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-secondary-container) var(--tb-state-hover),
          var(--p-md-secondary-container)
        );
      }
    }

    .tb-filter-chip__count {
      font: var(--tb-type-label-l-emphasized);
    }
  `,
})
export class FilterChips<T extends string> {
  /** The name of the set for assistive technology («Фильтр учеников»). */
  readonly label = input.required<string>();
  readonly chips = input.required<readonly FilterChip<T>[]>();
  /** The chosen chip. */
  readonly value = model.required<T>();
}
