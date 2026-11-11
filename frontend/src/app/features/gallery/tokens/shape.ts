import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TokenValue } from '../token-value';

const SHAPES = [
  '--tb-shape-xs',
  '--tb-shape-sm',
  '--tb-shape-md',
  '--tb-shape-lg',
  '--tb-shape-lg-plus',
  '--tb-shape-xl',
  '--tb-shape-xl-plus',
  '--tb-shape-2xl',
  '--tb-shape-full',
  '--tb-shape-button',
  '--tb-list-outer',
  '--tb-list-inner',
] as const;

/** §1 Shape: the radius scale; a corner takes one of these tokens and nothing else. */
@Component({
  selector: 'tb-gallery-shape',
  imports: [TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-gallery-grid">
      @for (token of shapes; track token) {
        <li class="tb-gallery-cell">
          <span class="tb-gallery-box" [style.border-radius]="'var(' + token + ')'"></span>
          <code class="tb-gallery-name">border-radius: var({{ token }})</code>
          <span class="tb-gallery-name">{{ token | tbTokenValue }}</span>
        </li>
      }
    </ul>
  `,
})
export class ShapeSample {
  protected readonly shapes = SHAPES;
}
