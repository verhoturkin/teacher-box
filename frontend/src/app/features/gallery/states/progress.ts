import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { timer } from 'rxjs';
import { Busy } from '@shared/ui/busy';
import { ProgressLabel } from '@shared/ui/progress-label.directive';

/**
 * §12 Progress and busy actions: `p-progressbar` named by `tbProgressLabel`; `Busy` keeps a request action
 * from being pressed twice and shows `[loading]` while the request runs (here a 2 s timer).
 */
@Component({
  selector: 'tb-gallery-progress',
  imports: [ButtonModule, ProgressBar, ProgressLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-cell">
      <p-progressbar [value]="50" [showValue]="false" tbProgressLabel="Done 2 of 4" />
      <code class="tb-gallery-name">p-progressbar [value] [showValue]="false" tbProgressLabel</code>
      <p-button label="Send" severity="secondary" [loading]="busy.is('send')" (onClick)="send()" />
      <code class="tb-gallery-name"
        >busy = new Busy(); [loading]="busy.is('send')"; busy.guard('send', request)</code
      >
    </div>
  `,
  styles: `
    p-progressbar {
      inline-size: 100%;
    }
  `,
})
export class ProgressSample {
  protected readonly busy = new Busy();

  protected send(): void {
    this.busy.guard('send', timer(2000)).subscribe();
  }
}
