import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { ChannelsPanel, PreferencesPanel, PushDevicesCard } from '@features/notifications/parts';
import { PageHeader } from '@shared/ui/page-header';
import { AccountPanel } from './account-panel';
import { T } from '../i18n/texts';

/**
 * «Мой аккаунт» of a student and the administrator; the teacher's is a category of the settings. A student
 * also connects own messengers and picks what to send there (redesign spec §10.4).
 */
@Component({
  selector: 'tb-account-page',
  imports: [AccountPanel, ChannelsPanel, PageHeader, PreferencesPanel, PushDevicesCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title" />
    @if (student) {
      <div class="tb-stack">
        <tb-account-panel />
        <tb-channels-panel />
        <tb-push-devices-card />
        <tb-preferences-panel />
      </div>
    } @else {
      <tb-account-panel />
    }
  `,
})
export class AccountPage {
  protected readonly t = T.account;
  protected readonly student = inject(AuthService).role() === 'STUDENT';
}
