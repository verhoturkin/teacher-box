import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Subscription, interval, switchMap } from 'rxjs';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelState, ChannelType, LinkCode } from '../data-access/notifications.models';
import { CHANNEL_HAS_START_LINK, CHANNEL_ICONS, CHANNEL_NAMES } from '../notification-labels';

/** How often the channel list is reloaded while the user is connecting a messenger. */
export const LINK_POLL_INTERVAL_MS = 3_000;

/** Messengers of the current user: connect with a one-time code, pause, disconnect. */
@Component({
  selector: 'tb-channels-panel',
  imports: [DatePipe, FormsModule, Button, Card, Dialog, ToggleSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Мессенджеры">
      @if (channels(); as channels) {
        @if (channels.length === 0) {
          <p class="tb-muted">
            @if (teacher()) {
              Боты мессенджеров не настроены. Чтобы уведомления приходили в Telegram, ВКонтакте или MAX, укажите токены
              ботов в настройках сервера (переменные TEACHERBOX_NOTIFICATIONS_*).
            } @else {
              Уведомления приходят в личный кабинет. Мессенджеры пока не подключены учителем.
            }
          </p>
        } @else {
          <p class="tb-muted">Уведомления будут дублироваться в подключённые мессенджеры.</p>
          <ul class="tb-channels">
            @for (channel of channels; track channel.channel) {
              <li class="tb-channel">
                <i [class]="icons[channel.channel]" aria-hidden="true"></i>
                <div class="tb-channel__info">
                  <strong>{{ names[channel.channel] }}</strong>
                  @if (channel.linked) {
                    <small class="tb-muted">
                      {{ channel.displayName ?? 'подключён' }}, с {{ channel.linkedAt | date: 'dd.MM.yyyy' }}
                    </small>
                  } @else {
                    <small class="tb-muted">не подключён</small>
                  }
                </div>
                @if (channel.linked) {
                  <p-toggleswitch
                    [ngModel]="channel.enabled"
                    (ngModelChange)="setEnabled(channel.channel, $event)"
                    [ariaLabel]="'Получать уведомления в ' + names[channel.channel]"
                  />
                  <p-button
                    icon="pi pi-times"
                    [text]="true"
                    severity="secondary"
                    [ariaLabel]="'Отключить ' + names[channel.channel]"
                    (onClick)="unlink(channel.channel)"
                  />
                } @else {
                  <p-button label="Подключить" icon="pi pi-link" size="small" [outlined]="true" (onClick)="connect(channel.channel)" />
                }
              </li>
            }
          </ul>
        }
      }
    </p-card>

    <p-dialog
      [header]="linkTitle()"
      [visible]="linkCode() !== null"
      (visibleChange)="onLinkVisibleChange($event)"
      [modal]="true"
      [style]="{ width: '30rem' }"
      [draggable]="false"
    >
      @if (linkCode(); as code) {
        <div class="tb-link-code">
          @if (code.url !== null && startLink(code.channel)) {
            <p>Откройте бота и нажмите «Запустить» — аккаунт подключится автоматически.</p>
            <a class="p-button tb-link-code__open" [href]="code.url" target="_blank" rel="noopener">
              <i class="pi pi-external-link" aria-hidden="true"></i>
              <span>Открыть {{ names[code.channel] }}</span>
            </a>
            <p class="tb-muted">Или отправьте боту код:</p>
          } @else {
            <p>
              Отправьте этот код
              @if (code.url !== null) {
                <a [href]="code.url" target="_blank" rel="noopener">боту {{ names[code.channel] }}</a>
              } @else {
                боту {{ names[code.channel] }}
              }
              в личные сообщения:
            </p>
          }
          <div class="tb-link-code__value">{{ code.code }}</div>
          <small class="tb-muted">Код действует до {{ code.expiresAt | date: 'HH:mm' }}. Ждём подключения…</small>
        </div>
      }
      <ng-template #footer>
        <p-button label="Закрыть" severity="secondary" [text]="true" (onClick)="closeLink()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .tb-channels {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-channel {
      display: flex;
      align-items: center;
      gap: 0.75rem;

      > i {
        font-size: 1.5rem;
        color: var(--p-primary-color);
      }
    }

    .tb-channel__info {
      display: flex;
      flex: 1;
      flex-direction: column;
    }

    .tb-link-code {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;

      p {
        margin: 0;
      }
    }

    .tb-link-code__open {
      display: inline-flex;
      gap: 0.5rem;
      text-decoration: none;
    }

    .tb-link-code__value {
      padding: 0.5rem 1rem;
      border-radius: var(--p-border-radius-md);
      background: var(--p-surface-100);
      font-family: monospace;
      font-size: 1.75rem;
      letter-spacing: 0.15em;
      user-select: all;
    }
  `,
})
export class ChannelsPanel implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly messages = inject(MessageService);
  private watch: Subscription | null = null;

  /** The teacher sees how to configure bots instead of a hint for students. */
  readonly teacher = input(false);

  protected readonly names = CHANNEL_NAMES;
  protected readonly icons = CHANNEL_ICONS;
  protected readonly channels = signal<ChannelState[] | null>(null);
  protected readonly linkCode = signal<LinkCode | null>(null);
  protected readonly linkTitle = computed(() => {
    const code = this.linkCode();
    return code === null ? '' : `Подключение ${CHANNEL_NAMES[code.channel]}`;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopWatching();
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected startLink(channel: ChannelType): boolean {
    return CHANNEL_HAS_START_LINK[channel];
  }

  connect(channel: ChannelType): void {
    this.api.createLinkCode(channel).subscribe((code) => {
      this.linkCode.set(code);
      this.watchLinking(channel);
    });
  }

  onLinkVisibleChange(visible: boolean): void {
    if (!visible) {
      this.closeLink();
    }
  }

  closeLink(): void {
    this.stopWatching();
    this.linkCode.set(null);
  }

  setEnabled(channel: ChannelType, enabled: boolean): void {
    this.api.setChannelEnabled(channel, enabled).subscribe((saved) => {
      this.replace(saved);
    });
  }

  unlink(channel: ChannelType): void {
    this.api.unlink(channel).subscribe(() => {
      this.messages.add({ severity: 'info', summary: 'Отключено', detail: `${CHANNEL_NAMES[channel]} отключён` });
      this.reload();
    });
  }

  private reload(): void {
    this.api.channels().subscribe((channels) => {
      this.channels.set(channels);
    });
  }

  /** Reloads the channels until the bot reports that the account is connected. */
  private watchLinking(channel: ChannelType): void {
    this.stopWatching();
    this.watch = interval(LINK_POLL_INTERVAL_MS)
      .pipe(switchMap(() => this.api.channels()))
      .subscribe((channels) => {
        this.channels.set(channels);
        if (channels.some((state) => state.channel === channel && state.linked)) {
          this.closeLink();
          this.messages.add({ severity: 'success', summary: 'Готово', detail: `${CHANNEL_NAMES[channel]} подключён` });
        }
      });
  }

  private stopWatching(): void {
    this.watch?.unsubscribe();
    this.watch = null;
  }

  private replace(saved: ChannelState): void {
    this.channels.update((channels) =>
      channels === null ? channels : channels.map((state) => (state.channel === saved.channel ? saved : state)),
    );
  }
}
