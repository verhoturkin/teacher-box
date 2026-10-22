import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BackupsCard, DrivePanel, DriveStore } from '@features/settings/parts';
import { Pane, Panes } from '@shared/ui/panes';
import { T } from '../i18n/texts';

/**
 * Administrator: backups of the portal — list, create and restore (ADR-0014). The same card as the teacher's
 * «Данные» (ADR-0048 D4: one component, with its title and help) in the pane of the admin pages.
 */
@Component({
  selector: 'tb-admin-backups-page',
  imports: [BackupsCard, DrivePanel, Panes, Pane],
  providers: [DriveStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <h1 class="tb-sr-only">{{ t.title }}</h1>
        <tb-backups-card area="admin" />
        <tb-drive-panel area="admin" />
      </tb-pane>
    </tb-panes>
  `,
})
export class BackupsPage {
  protected readonly t = T.backups;
}
