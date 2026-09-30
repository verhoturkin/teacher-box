import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast, ToastCloseEvent } from 'primeng/toast';
import { Snackbar } from '@core/snackbar/snackbar';

@Component({
  selector: 'tb-root',
  imports: [RouterOutlet, Toast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-toast position="bottom-center" (onClose)="closed($event)" />
    <router-outlet />
  `,
})
export class App {
  private readonly snackbar = inject(Snackbar);

  protected closed(event: ToastCloseEvent): void {
    this.snackbar.closed(event.message);
  }
}
