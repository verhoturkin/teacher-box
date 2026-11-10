import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TbDialog } from '@shared/ui/dialog/dialog';

/**
 * §11 `tb-dialog kind="alert"`: one decision and at most one field; a basic dialog at every width, no «✕»
 * from medium, the scrim closes it; the initial focus is on the headline. `confirmSeverity="danger"` — the
 * one red button of a dangerous confirmation.
 */
@Component({
  selector: 'tb-gallery-alert-dialog',
  imports: [ButtonModule, TbDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-gallery-row">
      <p-button label="Open an alert" severity="secondary" (onClick)="open.set(true)" />
      <p-button label="Open a danger alert" severity="secondary" (onClick)="danger.set(true)" />
    </div>
    <code class="tb-gallery-name"
      >tb-dialog kind="alert" [(visible)] headline confirmLabel (confirm)</code
    >
    <tb-dialog
      kind="alert"
      [(visible)]="open"
      headline="Switch to English?"
      confirmLabel="Switch"
      (confirm)="open.set(false)"
    >
      <p>The page reloads in the chosen language.</p>
    </tb-dialog>
    <tb-dialog
      kind="alert"
      [(visible)]="danger"
      headline="Delete the student?"
      confirmLabel="Delete"
      confirmSeverity="danger"
      (confirm)="danger.set(false)"
    >
      <p>Lessons, payments and homework of the student are deleted too.</p>
    </tb-dialog>
  `,
})
export class AlertDialogSample {
  protected readonly open = signal(false);
  protected readonly danger = signal(false);
}
