import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TokenValue } from '../token-value';

const SPACES = [1, 2, 3, 4, 5, 6, 7, 8, 16].map((n) => `--tb-space-${String(n)}`);

/** §1 Spacing: the 4 px grid, `--tb-space-N` = N × 4 px; gaps, paddings and margins take only these. */
@Component({
  selector: 'tb-gallery-spacing',
  imports: [TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-cell spacing">
      @for (token of spaces; track token) {
        <li class="tb-gallery-row">
          <span class="track"
            ><span class="bar" [style.inline-size]="'var(' + token + ')'"></span
          ></span>
          <code class="tb-gallery-name">gap: var({{ token }})</code>
          <span class="tb-gallery-name">{{ token | tbTokenValue }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    .spacing {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .track {
      display: flex;
      inline-size: var(--tb-space-16);
    }

    .bar {
      block-size: var(--tb-space-4);
      background: var(--p-md-primary);
    }
  `,
})
export class SpacingSample {
  protected readonly spaces = SPACES;
}
