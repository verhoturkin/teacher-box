import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BackupsCard } from '@features/settings/parts';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { T } from '../i18n/texts';

/** Administrator: backups of the portal — list, create and restore (ADR-0014). */
@Component({
  selector: 'tb-admin-backups-page',
  imports: [BackupsCard, PageHeader, HelpButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="admin/backups" />
    </tb-page-header>
    <tb-backups-card area="admin" />
  `,
})
export class BackupsPage {
  protected readonly t = T.backups;
}
