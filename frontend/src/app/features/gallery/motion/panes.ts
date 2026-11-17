import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Pane, Panes } from '@shared/ui/panes';
import { MotionPlayback, Replay } from '../motion-playback';

/**
 * §1 The page's motion: a pane of a known width (fixed, sheet) that appears after the page is coplanar —
 * its room grows from 0 on `--tb-spring-coplanar-spatial` and the flexible pane beside it narrows; it
 * leaves by shrinking (M3 video 7-5). The panes of a new page don't move. «Replay» shows and hides it.
 */
@Component({
  selector: 'tb-gallery-pane-motion',
  imports: [Pane, Panes, Replay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-gallery-replay />
    <code class="tb-gallery-name"
      >tb-pane kind="sheet" — .tb-pane--dock-in / .tb-pane--dock-out</code
    >
    <div class="window">
      <tb-panes>
        <tb-pane label="Page"><p>Here from the start: narrows and widens</p></tb-pane>
        @if (shown()) {
          <tb-pane kind="sheet" label="Sheet"
            ><p>Its room grows on --tb-spring-coplanar-spatial</p></tb-pane
          >
        }
      </tb-panes>
    </div>
  `,
  styles: `
    .window {
      block-size: 16rem;
      padding-top: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container);
      overflow: hidden;
    }
  `,
})
export class PaneMotionSample {
  private readonly playback = inject(MotionPlayback);
  protected readonly shown = computed(() => this.playback.round() % 2 === 1);
}
