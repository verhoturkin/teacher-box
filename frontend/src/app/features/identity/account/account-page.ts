import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeader } from '@shared/ui/page-header';
import { AccountPanel } from './account-panel';
import { T } from '../i18n/texts';

/** «Мой аккаунт» of a student and the administrator; the teacher's is a category of the settings. */
@Component({
  selector: 'tb-account-page',
  imports: [AccountPanel, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title" />
    <tb-account-panel />
  `,
})
export class AccountPage {
  protected readonly t = T.account;
}
