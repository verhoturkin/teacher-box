import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast, ToastCloseEvent } from 'primeng/toast';
import { FocusReturn } from '@core/a11y/focus-return';
import { Snackbar } from '@core/snackbar/snackbar';

/** The container of a message is a polite status (an error inside it is an alert, ADR-0024). */
const SNACKBAR_PT = { message: { role: 'status', 'aria-live': 'polite' } };

@Component({
  selector: 'tb-root',
  imports: [RouterOutlet, Toast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The M3 snackbar (ADR-0024): the text and «Закрыть», it does not take the focus -->
    <p-toast position="bottom-center" [pt]="pt" (onClose)="closed($event)">
      <ng-template #headless let-message let-close="closeFn">
        <div class="tb-snackbar">
          <span
            class="tb-snackbar__text"
            [attr.role]="message.severity === 'error' ? 'alert' : null"
            >{{ message.detail ?? message.summary }}</span
          >
          <button
            type="button"
            class="tb-snackbar__close"
            aria-label="Закрыть"
            (click)="close($event)"
          >
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </div>
      </ng-template>
    </p-toast>
    <router-outlet />
  `,
})
export class App {
  private readonly snackbar = inject(Snackbar);
  protected readonly pt = SNACKBAR_PT;

  constructor() {
    inject(FocusReturn).start();
  }

  protected closed(event: ToastCloseEvent): void {
    this.snackbar.closed(event.message);
  }
}
