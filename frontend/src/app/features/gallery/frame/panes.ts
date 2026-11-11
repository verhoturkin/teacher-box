import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Pane, PaneHeader, Panes } from '@shared/ui/panes';

/**
 * §7 Panes `tb-panes` > `tb-pane`: side by side from expanded (`kind="fixed"` 360 / 412 dp, the flexible one
 * takes the rest, `kind="sheet"` the standard side sheet), one after another below; a pane that appears after
 * the page enters on `--tb-spring-default-spatial`. The panes take the window's height.
 */
@Component({
  selector: 'tb-gallery-panes',
  imports: [ButtonModule, Pane, PaneHeader, Panes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button label="Toggle the sheet" severity="secondary" (onClick)="sheet.set(!sheet())" />
    <code class="tb-gallery-name">tb-panes > tb-pane kind="fixed" | (flexible) | kind="sheet"</code>
    <div class="window">
      <tb-panes>
        <tb-pane kind="fixed" label="List"><p>kind="fixed"</p></tb-pane>
        <tb-pane label="Detail">
          <ng-template tbPaneHeader><h3>Detail: ng-template tbPaneHeader</h3></ng-template>
          <p>flexible (the default)</p>
        </tb-pane>
        @if (sheet()) {
          <tb-pane kind="sheet" label="Sheet"><p>kind="sheet"</p></tb-pane>
        }
      </tb-panes>
    </div>
  `,
  styles: `
    .window {
      margin-top: var(--tb-space-3);
      padding-top: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container);
      overflow: hidden;
    }
  `,
})
export class PanesSample {
  protected readonly sheet = signal(false);
}
