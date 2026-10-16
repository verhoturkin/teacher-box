import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelState } from '../data-access/notifications.models';
import { CHANNEL_NAMES } from '../notification-labels';
import { hideHint, isHintHidden } from '@shared/storage/device-settings';
import { T } from '../i18n/texts';

/** Browser storage key: the student postponed connecting a messenger. */
export const CONNECT_DISMISSED_KEY = 'tb.connect-messenger.dismissed';

/** Student: invites to connect a messenger while none is connected. */
@Component({
  selector: 'tb-connect-messenger-card',
  imports: [RouterLink, Button, ButtonDirective, ButtonIcon, ButtonLabel, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <p-card [header]="t.title" styleClass="tb-connect-card">
        <p>{{ t.text(names()) }}</p>
        <div class="tb-actions">
          <a pButton routerLink="/cabinet/notifications" severity="secondary">
            <i pButtonIcon aria-hidden="true" class="tb-i tb-i-link"></i>
            <span pButtonLabel>{{ t.connect }}</span>
          </a>
          <p-button [label]="t.later" severity="secondary" [text]="true" (onClick)="dismiss()" />
        </div>
      </p-card>
    }
  `,
})
export class ConnectMessengerCard implements OnInit {
  protected readonly t = T.connect;
  private readonly api = inject(NotificationsApi);

  private readonly channels = signal<ChannelState[]>([]);
  private readonly dismissed = signal(isHintHidden(CONNECT_DISMISSED_KEY));

  protected readonly visible = computed(
    () =>
      !this.dismissed() &&
      this.channels().length > 0 &&
      this.channels().every((channel) => !channel.linked),
  );
  protected readonly names = computed(() => {
    const names = this.channels().map((channel) => CHANNEL_NAMES[channel.channel]);
    return names.length > 1
      ? T.connect.or(names.slice(0, -1).join(', '), names[names.length - 1] ?? '')
      : (names[0] ?? '');
  });

  ngOnInit(): void {
    if (!this.dismissed()) {
      this.api.channels().subscribe((channels) => {
        this.channels.set(channels);
      });
    }
  }

  dismiss(): void {
    hideHint(CONNECT_DISMISSED_KEY);
    this.dismissed.set(true);
  }
}
