import { Directive, ElementRef, afterRenderEffect, inject, input } from '@angular/core';

/**
 * The submit button of a dialog stands in its footer, outside the `<form>` in the body (ADR-0026):
 * `form` ties it to its form, so that Enter in a field submits it. `p-button` has no such attribute,
 * so the directive sets it on the inner `<button>`; the button must be `type="submit"`.
 */
@Directive({ selector: 'p-button[tbSubmitFor]' })
export class SubmitFor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The `id` of the form that the button submits. */
  readonly tbSubmitFor = input.required<string>();

  constructor() {
    afterRenderEffect(() => {
      this.host.nativeElement.querySelector('button')?.setAttribute('form', this.tbSubmitFor());
    });
  }
}
