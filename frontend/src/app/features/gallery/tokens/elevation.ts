import { ChangeDetectionStrategy, Component } from '@angular/core';

const LEVELS = ['--tb-elevation-1', '--tb-elevation-2', '--tb-elevation-3'] as const;

/** §1 Elevation: surfaces differ by tone; a shadow only on a floating element. */
@Component({
  selector: 'tb-gallery-elevation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid elevation">
      @for (token of levels; track token) {
        <li class="tb-gallery-cell">
          <span class="tb-gallery-box raised" [style.box-shadow]="'var(' + token + ')'"></span>
          <code class="tb-gallery-name">box-shadow: var({{ token }})</code>
        </li>
      }
    </ul>
  `,
  styles: `
    .elevation {
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface);
    }

    .raised {
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-low);
    }
  `,
})
export class ElevationSample {
  protected readonly levels = LEVELS;
}
