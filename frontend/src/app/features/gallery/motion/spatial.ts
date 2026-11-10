import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MotionPlayback, Replay } from '../motion-playback';
import { TokenValue } from '../token-value';

const SPATIAL = [
  '--tb-spring-fast-spatial',
  '--tb-spring-default-spatial',
  '--tb-spring-slow-spatial',
  '--tb-spring-standard-fast-spatial',
] as const;

/**
 * §1 Spatial springs (they overshoot): position, size and shape — `transition: transform var(<token>)`. The
 * standard one barely overshoots: turns that must not bounce and leaving overlays.
 */
@Component({
  selector: 'tb-gallery-spatial-springs',
  imports: [Replay, TokenValue],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-gallery-replay />
    <ul class="tb-gallery-cell">
      @for (token of tokens; track token) {
        <li class="tb-gallery-cell row">
          <span class="track">
            <span
              class="dot"
              [class.dot--end]="playback.round() % 2 === 1"
              [style.transition]="'transform var(' + token + ')'"
            ></span>
          </span>
          <code class="tb-gallery-name"
            >transition: transform var({{ token }}) —
            {{ (token | tbTokenValue).split(' ')[0] }}</code
          >
        </li>
      }
    </ul>
  `,
  styles: `
    .row {
      inline-size: 100%;
    }

    .track {
      display: block;
      inline-size: 100%;
      max-inline-size: 32rem;
      padding: var(--tb-space-1);
      box-sizing: border-box;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-surface-container-high);
      container-type: inline-size;
    }

    .dot {
      display: block;
      inline-size: var(--tb-space-6);
      block-size: var(--tb-space-6);
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary);
    }

    .dot--end {
      transform: translateX(calc(100cqi - 100%));
    }
  `,
})
export class SpatialSpringsSample {
  protected readonly tokens = SPATIAL;
  protected readonly playback = inject(MotionPlayback);
}
