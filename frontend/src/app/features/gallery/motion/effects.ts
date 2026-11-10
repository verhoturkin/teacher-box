import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MotionPlayback, Replay } from '../motion-playback';
import { TokenValue } from '../token-value';

const EFFECTS = [
  '--tb-spring-fast-effects',
  '--tb-spring-default-effects',
  '--tb-spring-slow-effects',
] as const;

/** §1 Effects springs (no overshoot): colour and opacity — `transition: background var(<token>)`. */
@Component({
  selector: 'tb-gallery-effects-springs',
  imports: [Replay, TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-gallery-replay />
    <ul class="tb-gallery-grid">
      @for (token of tokens; track token) {
        <li class="tb-gallery-cell">
          <span
            class="tb-gallery-box"
            [class.changed]="playback.round() % 2 === 1"
            [style.transition]="'background var(' + token + ')'"
          ></span>
          <code class="tb-gallery-name">transition: background var({{ token }})</code>
          <span class="tb-gallery-name">{{ (token | tbTokenValue).split(' ')[0] }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    .tb-gallery-box {
      border-radius: var(--tb-shape-lg);
    }

    .changed {
      background: var(--p-md-primary);
    }
  `,
})
export class EffectsSpringsSample {
  protected readonly tokens = EFFECTS;
  protected readonly playback = inject(MotionPlayback);
}
