import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Pane, Panes } from '@shared/ui/panes';
import { MotionPlayback, Replay } from '../motion-playback';

/**
 * §1 The page's motion: a pane that appears after the page (the detail beside a list) enters on
 * `--tb-spring-default-spatial`; the panes of a new page don't. «Replay» shows and hides the pane.
 */
@Component({
  selector: 'tb-gallery-pane-motion',
  imports: [Pane, Panes, Replay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-gallery-replay />
    <code class="tb-gallery-name"
      >tb-pane — .tb-pane--enter after the first render of tb-panes</code
    >
    <div class="window">
      <tb-panes>
        <tb-pane kind="fixed" label="List"><p>Here from the start: no motion</p></tb-pane>
        @if (shown()) {
          <tb-pane label="Detail"><p>Entered on --tb-spring-default-spatial</p></tb-pane>
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
