import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { SHARED_T } from '../i18n/texts';

/** One chip of {@link FilterChips}: its value, its label and, when it matters, the number it finds. */
export interface FilterChip<T extends string> {
  readonly value: T;
  readonly label: string;
  /** How many items the chip finds («Должники 2»); none — no number. */
  readonly count?: number;
}

/** A chip that opens a menu instead of choosing a value («Кому: все ▾»); `selected` — a choice is in force. */
export interface FilterMenuChip {
  readonly label: string;
  readonly selected: boolean;
  readonly items: MenuItem[];
}

/**
 * The chips that stay in the row of a one-row set: the `required` ones (the first and the chosen) and, in
 * order, as many following as fit next to the «Ещё N» button; `null` — all fit, no button is needed.
 * Widths are in pixels, `available` is the width of the row (0 — not laid out yet: everything is shown).
 */
export function fitChips(
  widths: readonly number[],
  required: ReadonlySet<number>,
  available: number,
  moreWidth: number,
  gap: number,
): ReadonlySet<number> | null {
  const total = widths.reduce((sum, width) => sum + width + gap, 0) - gap;
  if (available <= 0 || total <= available) {
    return null;
  }
  const limit = available - moreWidth;
  const shown = new Set(required);
  let used = 0;
  for (const index of shown) {
    used += (widths[index] ?? 0) + gap;
  }
  for (let index = 0; index < widths.length; index++) {
    if (shown.has(index)) {
      continue;
    }
    used += (widths[index] ?? 0) + gap;
    if (used > limit) {
      break;
    }
    shown.add(index);
  }
  return shown;
}

/**
 * A single-select set of M3 filter chips over a list (M3: an alternative to segmented buttons when viewing
 * a list): choosing a chip unselects the others. M3 filter chip: 32 dp high, 8 dp corners, 1 dp
 * `outline variant` and `on surface variant` label unselected; `secondary container` without the outline and
 * a leading 18 dp check selected; label `label large`. *Our decision:* the set wraps (no horizontal
 * scroll), 8 dp between chips, a 48 dp target over each chip.
 *
 * `oneRow` (a long set, e.g. the students of the schedule): the chips stay in one row, those that do not
 * fit go to a «Ещё N» menu (a 32 dp chip with a trailing drop-down arrow, *our decision*); the first chip
 * and the chosen one always stay in the row, so the filter in force is never hidden.
 *
 * ```html
 * <tb-filter-chips [label]="t.filters" [chips]="chips()" [(value)]="filter" />
 * ```
 */
@Component({
  selector: 'tb-filter-chips',
  imports: [Menu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'tb-filter-chips',
    '[class.tb-filter-chips--one-row]': 'oneRow()',
    role: 'group',
    '[attr.aria-label]': 'label()',
  },
  template: `
    @for (chip of chips(); track chip.value; let index = $index) {
      <button
        type="button"
        class="tb-filter-chip"
        data-chip
        [class.tb-filter-chip--selected]="chip.value === value()"
        [class.tb-filter-chip--overflow]="!isShown(index)"
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
    @if (menu(); as extra) {
      <button
        type="button"
        class="tb-filter-chip tb-filter-chip--menu"
        [class.tb-filter-chip--selected]="extra.selected"
        aria-haspopup="menu"
        [attr.aria-expanded]="extraOpen() ? 'true' : 'false'"
        (click)="extraMenu.toggle($event)"
      >
        <span>{{ extra.label }}</span>
        <i class="tb-i tb-i-arrow_drop_down" aria-hidden="true"></i>
      </button>
      <p-menu
        #extraMenu
        [model]="extra.items"
        [popup]="true"
        appendTo="body"
        (onShow)="extraOpen.set(true)"
        (onHide)="extraOpen.set(false)"
      />
    }
    @if (oneRow()) {
      <button
        type="button"
        class="tb-filter-chip tb-filter-chip--more"
        [class.tb-filter-chip--overflow]="hidden().length === 0"
        aria-haspopup="menu"
        [attr.aria-expanded]="menuOpen() ? 'true' : 'false'"
        (click)="popup.toggle($event)"
      >
        <span>{{ t.common.moreCount(hidden().length) }}</span>
        <i class="tb-i tb-i-arrow_drop_down" aria-hidden="true"></i>
      </button>
      <p-menu
        #popup
        [model]="items()"
        [popup]="true"
        appendTo="body"
        (onShow)="menuOpen.set(true)"
        (onHide)="menuOpen.set(false)"
      />
    }
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    /* one row: no wrapping; what is not measured yet is clipped (the focus ring keeps 8 dp) */
    :host(.tb-filter-chips--one-row) {
      flex-wrap: nowrap;
      overflow: clip;
      overflow-clip-margin: 0.5rem;
    }

    .tb-filter-chip {
      position: relative;
      display: inline-flex;
      flex: none;
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

    /* a menu chip has no check, only the trailing arrow (M3 dropdown chip) */
    .tb-filter-chip--menu {
      padding-inline: var(--tb-space-4) var(--tb-space-2);
    }

    /* «Ещё N»: a trailing arrow, so less padding on that side; a fixed least width keeps the measure stable */
    .tb-filter-chip--more {
      min-inline-size: 5.5rem;
      padding-inline-end: var(--tb-space-2);
    }

    /* out of the row but still measurable; hidden for everybody (no focus, no reading) */
    .tb-filter-chip--overflow {
      position: absolute;
      visibility: hidden;
      pointer-events: none;
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
  /** One row: the chips that do not fit go to the «Ещё N» menu. */
  readonly oneRow = input(false);
  /** A chip after the set that opens a menu (a second filter, «Кому: все ▾»). */
  readonly menu = input<FilterMenuChip | null>(null);

  protected readonly t = SHARED_T;
  protected readonly menuOpen = signal(false);
  protected readonly extraOpen = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** The indices of the chips in the row; `null` — all of them (nothing measured or everything fits). */
  private readonly shown = signal<ReadonlySet<number> | null>(null, {
    equal: (a, b) =>
      a === b || (a !== null && b !== null && a.size === b.size && [...a].every((i) => b.has(i))),
  });

  /** The chips in the «Ещё N» menu. */
  protected readonly hidden = computed(() => {
    const shown = this.shown();
    return shown === null ? [] : this.chips().filter((_, index) => !shown.has(index));
  });

  protected readonly items = computed<MenuItem[]>(() =>
    this.hidden().map((chip) => ({
      label: chip.count ? `${chip.label} ${String(chip.count)}` : chip.label,
      command: () => {
        this.value.set(chip.value);
      },
    })),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    // measured after every render of the chips: a new list or choice changes what fits
    afterRenderEffect(() => {
      this.chips();
      this.value();
      this.oneRow();
      this.measure();
    });
    afterNextRender(() => {
      // in the next frame: what the measure changes is not laid out inside the observer's own delivery
      const observer = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          this.measure();
        });
      });
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });
  }

  protected isShown(index: number): boolean {
    return this.shown()?.has(index) ?? true;
  }

  private measure(): void {
    if (!this.oneRow()) {
      this.shown.set(null);
      return;
    }
    const element = this.host.nativeElement;
    const widths = Array.from(element.querySelectorAll<HTMLElement>('[data-chip]'), (chip) => {
      return chip.offsetWidth;
    });
    const more = element.querySelector<HTMLElement>('.tb-filter-chip--more');
    const gap = Number.parseFloat(getComputedStyle(element).columnGap) || 0;
    const chosen = this.chips().findIndex((chip) => chip.value === this.value());
    const required = new Set([0, chosen].filter((index) => index >= 0));
    this.shown.set(
      fitChips(widths, required, element.clientWidth, (more?.offsetWidth ?? 0) + gap, gap),
    );
  }
}
