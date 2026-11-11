import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BothThemes } from '../both-themes';

/** A role and the role of its content: `background: var(--p-md-<fill>); color: var(--p-md-<on>)`. */
const PAIRS = [
  ['primary', 'on-primary'],
  ['primary-container', 'on-primary-container'],
  ['secondary-container', 'on-secondary-container'],
  ['tertiary-container', 'on-tertiary-container'],
  ['error', 'on-error'],
  ['error-container', 'on-error-container'],
  ['success', 'on-success'],
  ['success-container', 'on-success-container'],
  ['warning', 'on-warning'],
  ['warning-container', 'on-warning-container'],
  ['inverse-surface', 'inverse-on-surface'],
  ['inverse-surface', 'inverse-primary'],
] as const;

/** Text roles that stand on any surface. */
const TEXT = ['on-surface', 'on-surface-variant', 'primary', 'secondary', 'tertiary', 'error'];

/** §2 Colour: the accent roles `--p-md-*` with their content roles, in both themes. */
@Component({
  selector: 'tb-gallery-accent-roles',
  imports: [BothThemes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #sample>
      <ul class="tb-gallery-grid">
        @for (pair of pairs; track $index) {
          <li
            class="swatch"
            [style.background]="'var(--p-md-' + pair[0] + ')'"
            [style.color]="'var(--p-md-' + pair[1] + ')'"
          >
            <code>--p-md-{{ pair[0] }}</code>
            <code>--p-md-{{ pair[1] }}</code>
          </li>
        }
      </ul>
      <ul class="tb-gallery-row text">
        @for (role of text; track role) {
          <li [style.color]="'var(--p-md-' + role + ')'">
            <code>--p-md-{{ role }}</code>
          </li>
        }
      </ul>
    </ng-template>
    <tb-gallery-both-themes [sample]="sample" />
  `,
  styles: `
    .swatch {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      padding: var(--tb-space-3);
      border-radius: var(--tb-shape-md);
      font: var(--tb-type-body-s);
      overflow-wrap: anywhere;
    }

    .text {
      margin: 0;
      padding: 0;
      list-style: none;
      font: var(--tb-type-body-s);
    }
  `,
})
export class AccentRolesSample {
  protected readonly pairs = PAIRS;
  protected readonly text = TEXT;
}
