import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TbDialog, DialogHeaderActions } from '@shared/ui/dialog/dialog';
import { DialogConfirmStep } from '@shared/ui/dialog/dialog-confirm-step';

/**
 * §11 `tb-dialog kind="sheet"`: an object and its actions; a modal bottom sheet on compact, a basic dialog from
 * medium. Extra actions go to the header (`tbDialogHeaderActions`); `tb-dialog-confirm-step` asks inline.
 */
@Component({
  selector: 'tb-gallery-sheet-dialog',
  imports: [ButtonModule, TbDialog, DialogHeaderActions, DialogConfirmStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button label="Open a sheet" severity="secondary" (onClick)="open.set(true)" />
    <code class="tb-gallery-name"
      >tb-dialog kind="sheet" + ng-template[tbDialogHeaderActions] + tb-dialog-confirm-step</code
    >
    <tb-dialog kind="sheet" [(visible)]="open" headline="Lesson · Tue 14:00" [cancelLabel]="null">
      <ng-template tbDialogHeaderActions>
        <p-button
          icon="tb-i tb-i-delete"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          ariaLabel="Delete the lesson"
          (onClick)="asking.set(true)"
        />
      </ng-template>
      <p>Anna Petrova · English · 60 min</p>
      @if (asking()) {
        <tb-dialog-confirm-step
          message="Delete the lesson?"
          confirmLabel="Delete"
          (confirmed)="asking.set(false); open.set(false)"
          (cancelled)="asking.set(false)"
        />
      } @else {
        <div class="tb-button-group" role="group" aria-label="Lesson">
          <p-button label="Join" icon="tb-i tb-i-videocam" />
          <p-button label="Missed" severity="secondary" />
        </div>
      }
    </tb-dialog>
  `,
})
export class SheetDialogSample {
  protected readonly open = signal(false);
  protected readonly asking = signal(false);
}
