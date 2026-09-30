import { Directive, input } from '@angular/core';

/**
 * A progress bar with a name and without the `aria-level` PrimeNG 21 puts on it (a progressbar has
 * no level: axe reports it as critical, ADR-0024).
 *
 * `<p-progressbar [value]="50" tbProgressLabel="Сделано 2 из 4" />`
 */
@Directive({
  selector: 'p-progressbar[tbProgressLabel]',
  host: { '[attr.aria-level]': 'null', '[attr.aria-label]': 'tbProgressLabel()' },
})
export class ProgressLabel {
  readonly tbProgressLabel = input.required<string>();
}
