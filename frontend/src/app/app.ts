import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast, ToastCloseEvent } from 'primeng/toast';
import { FocusReturn } from '@core/a11y/focus-return';
import { KeyboardFocus } from '@core/a11y/keyboard-focus';
import { Snackbar } from '@core/snackbar/snackbar';
import { CORE_T } from '@core/i18n/texts';
import { CallHost } from '@features/meetings';

/** The container of a message is a polite status (an error inside it is an alert, ADR-0024). */
const SNACKBAR_PT = { message: { role: 'status', 'aria-live': 'polite' } };

@Component({
  selector: 'tb-root',
  imports: [RouterOutlet, Toast, ConfirmDialog, CallHost],
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
          @if (message.data?.undo) {
            <button
              type="button"
              class="tb-snackbar__action"
              (click)="message.data.undo(); close($event)"
            >
              {{ undoLabel }}
            </button>
          }
          <button
            type="button"
            class="tb-snackbar__close"
            [attr.aria-label]="closeLabel"
            (click)="close($event)"
          >
            <i class="tb-i tb-i-close" aria-hidden="true"></i>
          </button>
        </div>
      </ng-template>
    </p-toast>
    <router-outlet />
    <!-- The one host of every confirmation (ADR-0050): ask through the Confirm service -->
    <p-confirmdialog appendTo="body" />
    <!-- The built-in call (ADR-0030) lives above the routes, so it goes on while the user works; its code
         and the media library stay out of the first load -->
    @defer (on idle) {
      <tb-call-host />
    }
  `,
})
export class App {
  private readonly snackbar = inject(Snackbar);
  protected readonly pt = SNACKBAR_PT;
  protected readonly closeLabel = CORE_T.close;
  protected readonly undoLabel = CORE_T.undo;

  constructor() {
    inject(KeyboardFocus).start();
    inject(FocusReturn).start();
  }

  protected closed(event: ToastCloseEvent): void {
    this.snackbar.closed(event.message);
  }
}
