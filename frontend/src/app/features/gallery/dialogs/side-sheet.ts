import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { ModalDrawer } from '@shared/ui/modal-drawer';

/**
 * §11 The modal side sheet `p-drawer.tb-side-sheet` with `tbModalDrawer` (the help, the bell below extra-large):
 * a dialog with a focus trap, Esc and the focus back to the opener.
 */
@Component({
  selector: 'tb-gallery-side-sheet',
  imports: [ButtonModule, Drawer, ModalDrawer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button label="Open a side sheet" severity="secondary" (onClick)="open.set(true)" />
    <code class="tb-gallery-name"
      >p-drawer tbModalDrawer position="right" styleClass="tb-side-sheet"</code
    >
    <p-drawer
      tbModalDrawer
      [visible]="open()"
      (visibleChange)="open.set($event)"
      position="right"
      appendTo="body"
      [blockScroll]="true"
      ariaCloseLabel="Close"
      styleClass="tb-side-sheet"
    >
      <ng-template #header>
        <div class="tb-side-sheet__head">
          <span class="p-drawer-title">Help</span>
        </div>
      </ng-template>
      <p>The article of the help opens here.</p>
    </p-drawer>
  `,
})
export class SideSheetSample {
  protected readonly open = signal(false);
}
