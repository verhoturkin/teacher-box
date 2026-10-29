import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * An M3 input chip: a chosen entity (a student, a group) that can be removed. 32 dp, 8 dp corners, an
 * outline-variant border, a leading 24 dp avatar or 18 dp icon (`<… lead>`), a trailing «×» button named
 * `removeLabel` (the name of the entity is in it: «Убрать: Анна»).
 */
@Component({
  selector: 'tb-input-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tb-input-chip__lead"><ng-content select="[lead]" /></span>
    <span class="tb-input-chip__label">{{ label() }}</span>
    <button
      type="button"
      class="tb-input-chip__remove"
      [attr.aria-label]="removeLabel()"
      (click)="removed.emit()"
    >
      <i class="tb-i tb-i-close" aria-hidden="true"></i>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
      block-size: 2rem;
      box-sizing: border-box;
      padding-inline: var(--tb-space-1) 0;
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-sm);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
    }

    .tb-input-chip__lead {
      display: inline-flex;
      font-size: 1.125rem;
    }

    .tb-input-chip__remove {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      block-size: 2rem;
      inline-size: 1.75rem;
      padding: 0;
      border: 0;
      border-radius: var(--tb-shape-sm);
      background: transparent;
      color: inherit;
      font-size: 1.125rem;
      cursor: pointer;

      /* the 48 dp target (M3) */
      &::before {
        content: '';
        position: absolute;
        inset: -0.5rem -0.25rem;
      }

      &:hover {
        background: color-mix(
          in srgb,
          var(--p-md-on-surface-variant) var(--tb-state-hover),
          transparent
        );
      }
    }
  `,
})
export class InputChip {
  readonly label = input.required<string>();
  readonly removeLabel = input.required<string>();
  readonly removed = output();
}
