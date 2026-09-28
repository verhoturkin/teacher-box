import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Portal } from './portal';

/** The portal's own logo, or the default icon (ADR-0015). */
@Component({
  selector: 'tb-portal-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (logo(); as logo) {
      <img class="tb-portal-logo" [src]="logo" alt="" [style.height]="size()" />
    } @else {
      <i class="pi pi-graduation-cap" aria-hidden="true" [style.font-size]="size()"></i>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      color: var(--p-primary-color);
    }

    .tb-portal-logo {
      width: auto;
      max-width: 8rem;
      object-fit: contain;
    }
  `,
})
export class PortalLogo {
  /** Height of the logo, e.g. `2rem`. */
  readonly size = input('1.25rem');

  protected readonly logo = inject(Portal).logo;
}
