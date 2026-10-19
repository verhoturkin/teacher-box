import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HelpButton } from '@features/help/parts';
import { AuthService } from '@core/auth/auth.service';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { ChannelsPanel } from './channels/channels-panel';
import { InboxPanel } from './inbox/inbox-panel';
import { PreferencesPanel } from './preferences/preferences-panel';
import { BroadcastsPanel } from './teacher/broadcasts-panel';
import { FoldCard } from '@shared/ui/fold-card';
import { PageHeader } from '@shared/ui/page-header';
import { T } from './i18n/texts';

/**
 * Notifications of the current user, a stack of cards in one column (ADR-0021). The teacher sees the inbox and
 * the messages to students; the bots and messengers are a category of the settings (redesign spec §10.3), the
 * page itself moves into the bell in 235. The student also connects own messengers and picks what to send.
 */
@Component({
  selector: 'tb-notifications-page',
  imports: [
    HelpButton,
    BroadcastsPanel,
    ChannelsPanel,
    FoldCard,
    InboxPanel,
    PreferencesPanel,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help [topic]="teacher ? 'teacher/notifications' : 'cabinet/bot'" />
    </tb-page-header>
    @if (teacher) {
      <div class="tb-stack">
        <tb-fold-card
          id="notifications-inbox"
          [title]="t.inbox"
          [collapsible]="false"
          [badge]="unread()"
        >
          <ng-template><tb-inbox-panel /></ng-template>
        </tb-fold-card>
        <tb-fold-card id="notifications-messages" [title]="t.messages" [collapsible]="false">
          <ng-template><tb-broadcasts-panel /></ng-template>
        </tb-fold-card>
      </div>
    } @else {
      <div class="tb-stack">
        <tb-inbox-panel />
        <tb-channels-panel />
        <tb-preferences-panel />
      </div>
    }
  `,
})
export class NotificationsPage {
  protected readonly t = T.page;
  protected readonly teacher = inject(AuthService).user()?.role === 'TEACHER';
  protected readonly unread = inject(UnreadNotifications).count;
}
