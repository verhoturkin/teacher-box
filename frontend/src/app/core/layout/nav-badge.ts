import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The largest number the badge shows (M3: three characters at most). */
const MAX = 999;

/**
 * M3 large badge on a destination of the rail or the bottom bar: a pill with the number, error / on-error.
 * The caller renders it above 0. It sits by the label in the expanded rail and on the corner of the icon otherwise (`inline`).
 */
@Component({
  selector: 'tb-nav-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tb-nav-badge--inline]': 'inline()',
    'aria-hidden': 'true',
  },
  template: `{{ text() }}`,
  styles: `
    :host {
      position: absolute;
      inset-block-start: 0;
      inset-inline-start: calc(50% + 2px);
      box-sizing: border-box;
      min-width: 1rem;
      height: 1rem;
      padding: 0 0.25rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-error);
      color: var(--p-md-on-error);
      font: var(--tb-type-label-s);
      line-height: 1rem;
      text-align: center;
      pointer-events: none;
    }

    :host(.tb-nav-badge--inline) {
      position: static;
      align-self: center;
    }
  `,
})
export class NavBadge {
  readonly count = input.required<number>();
  /** In the flow of the row (the expanded rail) instead of on the icon. */
  readonly inline = input(false);

  protected readonly text = computed(() =>
    this.count() > MAX ? `${String(MAX)}+` : String(this.count()),
  );
}
