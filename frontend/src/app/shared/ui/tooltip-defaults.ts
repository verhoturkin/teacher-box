import { Tooltip } from 'primeng/tooltip';

/**
 * M3 plain tooltip (stage 329.1): below the element, flipped above by PrimeNG's `align()` when there is no room
 * (order bottom, top, right, left), never to the side by choice. PrimeNG has no global default for
 * `tooltipPosition` (its own is `right`), so the default is set once on the directive; an explicit
 * `tooltipPosition` still wins.
 */
export function applyTooltipDefaults(): void {
  const init: unknown = Reflect.get(Tooltip.prototype, 'ngOnInit');
  Tooltip.prototype.ngOnInit = function (this: Tooltip) {
    if (typeof init === 'function') Reflect.apply(init, this, []);
    if (!this.tooltipPosition) this.setOption({ tooltipPosition: 'bottom' });
  };
}
