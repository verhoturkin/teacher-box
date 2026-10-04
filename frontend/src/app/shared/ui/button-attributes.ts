import { Directive, ElementRef, afterRenderEffect, inject, input } from '@angular/core';

/**
 * Attributes of the inner `<button>` of a `p-button`, which PrimeNG does not pass on (e.g.
 * `aria-haspopup` and `aria-expanded` of a button that opens a menu, ADR-0026): `null` removes one.
 */
@Directive({ selector: 'p-button[tbAttributes]' })
export class ButtonAttributes {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tbAttributes = input.required<Readonly<Record<string, string | null>>>();

  constructor() {
    afterRenderEffect(() => {
      const button = this.host.nativeElement.querySelector('button');
      for (const [name, value] of Object.entries(this.tbAttributes())) {
        if (value === null) {
          button?.removeAttribute(name);
        } else {
          button?.setAttribute(name, value);
        }
      }
    });
  }
}
