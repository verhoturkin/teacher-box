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
import { Busy } from '@shared/ui/busy';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** How often the channel list is reloaded while the user is connecting a messenger. */
export const LINK_POLL_INTERVAL_MS = 3_000;

/** Messengers of the current user: connect with a one-time code, pause, disconnect. */
@Component({
  selector: 'tb-channels-panel',
  imports: [
    EmptyState,
    DatePipe,
    FormsModule,
    Button,
    Card,
    Dialog,
    LinkCodeView,
    ToggleSwitch,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="header()">
      @if (channels(); as channels) {
        @if (channels.length === 0) {
          <tb-empty-state
            [compact]="true"
            icon="tb-i-forum"
            [title]="teacher() ? t.noBotsTitle : t.noMessengersTitle"
            [hint]="teacher() ? t.noBotsHint : t.noMessengersHint"
          />
        } @else {
          <p class="tb-muted">{{ t.duplicated }}</p>
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
                      {{ channel.displayName ?? t.linked }},
                      {{ t.since((channel.linkedAt | date: 'dd.MM.yyyy') ?? '') }}
                      @if (!channel.enabled) {
                        · {{ t.paused }}
                      }
                    </span>
                  } @else {
                    <span class="tb-list__supporting">{{ t.notLinked }}</span>
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
                      {{ t.send }}
                    </label>
                    <p-button
                      icon="tb-i tb-i-close"
                      [text]="true"
                      [pTooltip]="t.unlink(names[channel.channel])"
                      [rounded]="true"
                      severity="danger"
                      [ariaLabel]="t.unlink(names[channel.channel])"
                      [loading]="busy.is('unlink-' + channel.channel)"
                      (onClick)="unlink(channel.channel)"
                    />
                  } @else {
                    <p-button
                      [label]="t.connect"
                      icon="tb-i tb-i-link"
                      severity="secondary"
                      [text]="true"
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
      styleClass="tb-dialog tb-dialog--short"
      [draggable]="false"
    >
      @if (linkCode(); as code) {
        <tb-link-code-view [code]="code" />
      }
      <ng-template #footer>
        <p-button [label]="c.close" severity="secondary" [text]="true" (onClick)="closeLink()" />
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
  protected readonly c = SHARED_T.common;
  protected readonly t = T.channels;
  protected readonly busy = new Busy();
  private readonly api = inject(NotificationsApi);
  private readonly snackbar = inject(Snackbar);
  private watch: Subscription | null = null;

  /** The teacher sees how to configure bots instead of a hint for students. */
  readonly teacher = input(false);
  /** Card title. */
  readonly header = input(T.channels.header);
  /** An account was connected or disconnected. */
  readonly changed = output();

  protected readonly names = CHANNEL_NAMES;
  protected readonly icons = CHANNEL_ICONS;
  protected readonly channels = signal<ChannelState[] | null>(null);
  protected readonly linkCode = signal<LinkCode | null>(null);
  protected readonly linkTitle = computed(() => {
    const code = this.linkCode();
    return code === null ? '' : T.channels.linkTitle(CHANNEL_NAMES[code.channel]);
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
    this.busy.guard('unlink-' + channel, this.api.unlink(channel)).subscribe(() => {
      this.snackbar.info(T.channels.unlinked(CHANNEL_NAMES[channel]));
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
          this.snackbar.success(T.channels.connected(CHANNEL_NAMES[channel]));
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
