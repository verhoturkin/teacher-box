import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BackupsCard } from '@features/settings/parts';

/** Administrator: backups of the portal — list, create and restore (ADR-0014). */
@Component({
  selector: 'tb-admin-backups-page',
  imports: [BackupsCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Резервные копии</h1>
    <tb-backups-card area="admin" />
  `,
})
export class BackupsPage {}
