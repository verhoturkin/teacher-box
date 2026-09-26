import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelState } from '../data-access/notifications.models';
import { CHANNEL_NAMES } from '../notification-labels';

/** Browser storage key: the student postponed connecting a messenger. */
export const CONNECT_DISMISSED_KEY = 'tb.connect-messenger.dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(CONNECT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(CONNECT_DISMISSED_KEY, '1');
  } catch {
    // Storage is unavailable: the card just shows up again next time.
  }
}

/** Student: invites to connect a messenger while none is connected. */
@Component({
  selector: 'tb-connect-messenger-card',
  imports: [RouterLink, Button, ButtonDirective, ButtonIcon, ButtonLabel, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <p-card header="Получайте уведомления в мессенджере" styleClass="tb-connect-card">
        <p>
          Подключите {{ names() }} — напоминания о занятиях, новые задания и сообщения учителя будут приходить сразу, без
          захода в личный кабинет.
        </p>
        <div class="tb-actions">
          <a pButton routerLink="/cabinet/notifications">
            <i pButtonIcon class="pi pi-link"></i>
            <span pButtonLabel>Подключить</span>
          </a>
          <p-button label="Не сейчас" severity="secondary" [text]="true" (onClick)="dismiss()" />
        </div>
      </p-card>
    }
  `,
})
export class ConnectMessengerCard implements OnInit {
  private readonly api = inject(NotificationsApi);

  private readonly channels = signal<ChannelState[]>([]);
  private readonly dismissed = signal(readDismissed());

  protected readonly visible = computed(
    () => !this.dismissed() && this.channels().length > 0 && this.channels().every((channel) => !channel.linked),
  );
  protected readonly names = computed(() => {
    const names = this.channels().map((channel) => CHANNEL_NAMES[channel.channel]);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} или ${names[names.length - 1] ?? ''}` : (names[0] ?? '');
  });

  ngOnInit(): void {
    if (!this.dismissed()) {
      this.api.channels().subscribe((channels) => {
        this.channels.set(channels);
      });
    }
  }

  dismiss(): void {
    writeDismissed();
    this.dismissed.set(true);
  }
}
