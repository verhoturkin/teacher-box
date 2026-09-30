import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * «Показать пароль» of a password field (ADR-0024): a 40×40 icon button inside the field instead of
 * PrimeNG's bare icon, reachable with Tab and named. It goes into the `#showicon` and `#hideicon`
 * templates of `p-password`, whose wrapper toggles the mask on its click.
 *
 * ```html
 * <p-password …>
 *   <ng-template #showicon><tb-password-toggle /></ng-template>
 *   <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
 * </p-password>
 * ```
 */
@Component({
  selector: 'tb-password-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="tb-password-toggle"
      [attr.aria-label]="shown() ? 'Скрыть пароль' : 'Показать пароль'"
      [attr.aria-pressed]="shown()"
    >
      <i [class]="shown() ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i>
    </button>
  `,
  styles: `
    :host {
      position: absolute;
      top: 50%;
      inset-inline-end: var(--tb-space-2);
      z-index: 1;
      transform: translateY(-50%);
    }

    .tb-password-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      padding: 0;
      border: 0;
      border-radius: var(--tb-shape-full);
      background: none;
      color: var(--p-md-on-surface-variant);
      cursor: pointer;

      &:hover {
        background: color-mix(in srgb, var(--p-md-on-surface) 8%, transparent);
      }

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }

      i {
        font-size: 1.25rem;
      }
    }
  `,
})
export class PasswordToggle {
  /** The password is shown (the button hides it). */
  readonly shown = input(false);
}
