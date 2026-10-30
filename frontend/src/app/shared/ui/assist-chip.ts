import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * An M3 assist chip: a smart, optional action next to a field («Файл», «Учебник», «Ученик или группа»).
 * 32 dp, 8 dp corners, outline-variant border, a leading 18 dp primary icon; `dashed` — the chip that adds
 * something not there yet. The click is the host's: `<tb-assist-chip icon="attach_file" (click)="pick()">`.
 */
@Component({
  selector: 'tb-assist-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [class.tb-assist-chip--dashed]="dashed()" [disabled]="disabled()">
      @if (icon(); as name) {
        <i class="tb-i" [class]="'tb-i-' + name" aria-hidden="true"></i>
      }
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    button {
      position: relative;
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: var(--tb-space-2);
      block-size: 2rem;
      box-sizing: border-box;
      padding: 0 var(--tb-space-4) 0 var(--tb-space-2);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-sm);
      background: transparent;
      color: var(--p-md-on-surface);
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
        background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
      }

      &:disabled {
        opacity: 0.38;
        cursor: default;
        background: transparent;
      }
    }

    .tb-assist-chip--dashed {
      border-style: dashed;
    }

    .tb-i {
      color: var(--p-md-primary);
      font-size: 1.125rem;
    }
  `,
})
export class AssistChip {
  /** The Material Symbol before the label, without the `tb-i-` prefix. */
  readonly icon = input<string>();
  readonly dashed = input(false);
  readonly disabled = input(false);
}
