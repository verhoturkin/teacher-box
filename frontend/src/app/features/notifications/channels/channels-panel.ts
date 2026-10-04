import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { Subscription, interval, switchMap } from 'rxjs';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelState, ChannelType, LinkCode } from '../data-access/notifications.models';
import { CHANNEL_ICONS, CHANNEL_NAMES } from '../notification-labels';
import { LinkCodeView } from './link-code-view';
import { Snackbar } from '@core/snackbar/snackbar';

/** How often the channel list is reloaded while the user is connecting a messenger. */
export const LINK_POLL_INTERVAL_MS = 3_000;

/** Messengers of the current user: connect with a one-time code, pause, disconnect. */
@Component({
  selector: 'tb-channels-panel',
  imports: [DatePipe, FormsModule, Button, Card, Dialog, LinkCodeView, ToggleSwitch, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="header()">
      @if (channels(); as channels) {
        @if (channels.length === 0) {
          <p class="tb-muted">
            @if (teacher()) {
              Боты мессенджеров ещё не подключены. Подключите бота выше — и сможете получать
              уведомления сами и присылать их ученикам.
            } @else {
              Уведомления приходят в личный кабинет. Мессенджеры пока не подключены учителем.
            }
          </p>
        } @else {
          <p class="tb-muted">Уведомления будут дублироваться в подключённые мессенджеры.</p>
          <ul class="tb-list tb-channels">
            @for (channel of channels; track channel.channel) {
              <li class="tb-channel">
                <span class="tb-list__lead" aria-hidden="true"
                  ><i [class]="icons[channel.channel]"></i
                ></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ names[channel.channel] }}</span>
                  @if (channel.linked) {
                    <span class="tb-list__supporting">
                      {{ channel.displayName ?? 'подключён' }}, с
                      {{ channel.linkedAt | date: 'dd.MM.yyyy' }}
                      @if (!channel.enabled) {
                        · на паузе
                      }
                    </span>
                  } @else {
                    <span class="tb-list__supporting">не подключён</span>
                  }
                </div>
                <div class="tb-list__trail">
                  @if (channel.linked) {
                    <!-- the switch has its visible label (ADR-0024) -->
                    <label class="tb-switch" [for]="'channel-enabled-' + channel.channel">
                      <p-toggleswitch
                        [inputId]="'channel-enabled-' + channel.channel"
                        [ngModel]="channel.enabled"
                        (ngModelChange)="setEnabled(channel.channel, $event)"
                      />
                      Присылать
                    </label>
                    <p-button
                      icon="pi pi-times"
                      [text]="true"
                      [pTooltip]="'Отключить ' + names[channel.channel]"
                      [rounded]="true"
                      severity="danger"
                      [ariaLabel]="'Отключить ' + names[channel.channel]"
                      (onClick)="unlink(channel.channel)"
                    />
                  } @else {
                    <p-button
                      label="Подключить"
                      icon="pi pi-link"
                      severity="secondary"
                      (onClick)="connect(channel.channel)"
                    />
                  }
                </div>
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
      appendTo="body"
      [style]="{ width: '30rem' }"
      [draggable]="false"
    >
      @if (linkCode(); as code) {
        <tb-link-code-view [code]="code" />
      }
      <ng-template #footer>
        <p-button label="Закрыть" severity="secondary" [text]="true" (onClick)="closeLink()" />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .tb-channels {
      margin-top: var(--tb-space-3);
    }
  `,
})
export class ChannelsPanel implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly snackbar = inject(Snackbar);
  private watch: Subscription | null = null;

  /** The teacher sees how to configure bots instead of a hint for students. */
  readonly teacher = input(false);
  /** Card title. */
  readonly header = input('Мессенджеры');
  /** An account was connected or disconnected. */
  readonly changed = output();

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
      this.snackbar.info(`${CHANNEL_NAMES[channel]} отключён`);
      this.reload();
      this.changed.emit();
    });
  }

  /** Reloads the messengers (e.g. after the teacher configured a bot). */
  reload(): void {
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
          this.snackbar.success(`${CHANNEL_NAMES[channel]} подключён`);
          this.changed.emit();
        }
      });
  }

  private stopWatching(): void {
    this.watch?.unsubscribe();
    this.watch = null;
  }

  private replace(saved: ChannelState): void {
    this.channels.update((channels) =>
      channels === null
        ? channels
        : channels.map((state) => (state.channel === saved.channel ? saved : state)),
    );
  }
}
