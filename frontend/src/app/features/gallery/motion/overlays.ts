import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Snackbar } from '@core/snackbar/snackbar';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { Replay } from '../motion-playback';

/** How each overlay enters and leaves (`styles.scss` «Overlays on M3E springs»). */
const OVERLAYS = [
  [
    'dialog',
    'scale 0.93 on default spatial + default effects',
    'standard fast spatial + fast effects',
  ],
  [
    'menu, dropdown, date picker',
    'scale 0.93 on fast spatial + fast effects',
    'standard fast spatial + fast effects',
  ],
  [
    'snackbar',
    'scale 0.8 on fast spatial + fast effects',
    'fast effects + collapse on standard fast',
  ],
  ['scrim', 'default effects', 'fast effects'],
] as const;

/** §1 and §11 The openings of dialogs, menus and the snackbar: the buttons replay them; they enter on a spring and leave without a bounce. */
@Component({
  selector: 'tb-gallery-overlay-motion',
  imports: [ButtonModule, Menu, TbDialog, Replay],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-gallery-replay [replay]="false" />
    <div class="tb-gallery-row">
      <p-button label="Dialog" severity="secondary" (onClick)="dialog.set(true)" />
      <p-button label="Menu" severity="secondary" (onClick)="menu.toggle($event)" />
      <p-button label="Snackbar" severity="secondary" (onClick)="snackbar.info('Saved')" />
    </div>
    <ul class="tb-gallery-cell">
      @for (overlay of overlays; track overlay[0]) {
        <li>
          <code class="tb-gallery-name"
            >{{ overlay[0] }}: in — {{ overlay[1] }}; out — {{ overlay[2] }}</code
          >
        </li>
      }
    </ul>
    <p-menu #menu [model]="items" [popup]="true" appendTo="body" />
    <tb-dialog
      kind="alert"
      [(visible)]="dialog"
      headline="A dialog"
      confirmLabel="Close"
      [cancelLabel]="null"
      (confirm)="dialog.set(false)"
    >
      <p>Entered on --tb-spring-default-spatial.</p>
    </tb-dialog>
  `,
})
export class OverlayMotionSample {
  protected readonly snackbar = inject(Snackbar);
  protected readonly overlays = OVERLAYS;
  protected readonly dialog = signal(false);
  protected readonly items: MenuItem[] = [
    { label: 'Edit', icon: 'tb-i tb-i-edit' },
    { label: 'Copy', icon: 'tb-i tb-i-content_copy' },
  ];
}
