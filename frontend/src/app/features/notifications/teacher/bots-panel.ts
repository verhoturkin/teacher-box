import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Menu } from 'primeng/menu';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelSetup, ChannelType } from '../data-access/notifications.models';
import { CHANNEL_ICONS, CHANNEL_NAMES, CONNECTION_TAGS } from '../notification-labels';
import { BotWizardDialog } from './bot-wizard-dialog';
import { Confirm } from '@shared/ui/confirm';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';

/**
 * Teacher: messenger bots of the instance (sketch Messengers, «Боты») — connect with a wizard; check and
 * remove from the bot's menu.
 */
@Component({
  selector: 'tb-bots-panel',
  imports: [Button, Card, Menu, Tag, BotWizardDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title" styleClass="tb-section-card tb-section-card--flow">
      <p class="tb-muted">{{ t.about }}</p>
      <ul class="tb-list tb-bots">
        @for (bot of bots(); track bot.channel) {
          <li class="tb-bot">
            <span class="tb-list__lead" aria-hidden="true"
              ><i [class]="icons[bot.channel]"></i
            ></span>
            <div class="tb-list__text">
              <span class="tb-list__title">{{ names[bot.channel] }}</span>
              @if (bot.configured) {
                <span class="tb-list__supporting">
                  {{ bot.botName ?? t.fromServer }}
                  @if (!bot.teacherLinked) {
                    · {{ t.notLinked }}
                  }
                </span>
                @if (bot.connection.connection === 'ERROR') {
                  <span class="tb-list__supporting tb-bot__error">
                    {{ bot.connection.error }}
                    @if (bot.channel === 'TELEGRAM') {
                      {{ t.telegramBlocked }}
                    }
                  </span>
                }
              } @else {
                <span class="tb-list__supporting">{{ t.notConnected }}</span>
              }
            </div>
            <div class="tb-list__trail" [class.tb-list__trail--inline]="!bot.configured">
              @if (bot.configured) {
                @let tag = tags[bot.connection.connection];
                <p-tag [value]="tag.value" [severity]="tag.severity" />
                <p-button
                  icon="tb-i tb-i-more_vert"
                  severity="secondary"
                  [text]="true"
                  [rounded]="true"
                  [ariaLabel]="t.actions(names[bot.channel])"
                  aria-haspopup="menu"
                  (onClick)="openMenu($event, bot)"
                />
              } @else {
                <p-button
                  [label]="t.connect"
                  severity="secondary"
                  icon="tb-i tb-i-add"
                  (onClick)="open(bot)"
                />
              }
            </div>
          </li>
        }
      </ul>
      <!-- «Что умеет бот» (sketch Messengers: inside the card of the bots) -->
      <ng-content />
    </p-card>
    <p-menu #menu [model]="menuItems()" [popup]="true" appendTo="body" />

    <tb-bot-wizard-dialog
      [visible]="wizardVisible()"
      (visibleChange)="onWizardVisibleChange($event)"
      [channel]="wizardChannel()"
      [setup]="wizardSetup()"
      (changed)="onChanged($event)"
    />
  `,
  styles: `
    .tb-bot__error {
      color: var(--p-md-error);
    }
  `,
})
export class BotsPanel implements OnInit {
  protected readonly t = T.bots;
  private readonly api = inject(NotificationsApi);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);

  /** A bot was connected, replaced or removed. */
  readonly changed = output();

  protected readonly names = CHANNEL_NAMES;
  protected readonly icons = CHANNEL_ICONS;
  protected readonly tags = CONNECTION_TAGS;
  protected readonly bots = signal<ChannelSetup[]>([]);
  protected readonly wizardVisible = signal(false);
  protected readonly wizardChannel = signal<ChannelType>('TELEGRAM');
  protected readonly wizardSetup = signal<ChannelSetup | null>(null);
  protected readonly menuItems = signal<MenuItem[]>([]);
  private readonly menu = viewChild.required<Menu>('menu');

  ngOnInit(): void {
    this.reload();
  }

  open(bot: ChannelSetup): void {
    this.wizardChannel.set(bot.channel);
    this.wizardSetup.set(bot);
    this.wizardVisible.set(true);
  }

  protected openMenu(event: Event, bot: ChannelSetup): void {
    const items: MenuItem[] = [
      {
        label: bot.teacherLinked ? this.t.check : this.t.setUp,
        icon: 'tb-i tb-i-settings',
        command: () => {
          this.open(bot);
        },
      },
    ];
    items.push({
      label: this.t.removeItem,
      icon: 'tb-i tb-i-delete',
      command: () => void this.confirmRemove(bot.channel),
    });
    this.menuItems.set(items);
    this.menu().toggle(event);
  }

  /** Fresh connection states once the wizard is closed. */
  onWizardVisibleChange(visible: boolean): void {
    this.wizardVisible.set(visible);
    if (!visible) {
      this.reload();
    }
  }

  onChanged(saved: ChannelSetup): void {
    this.bots.update((bots) => bots.map((bot) => (bot.channel === saved.channel ? saved : bot)));
    this.changed.emit();
  }

  async confirmRemove(channel: ChannelType): Promise<void> {
    if (
      await this.confirm.danger({
        header: T.bots.removeHeader,
        message: T.bots.removeMessage(CHANNEL_NAMES[channel]),
        acceptLabel: T.bots.removeAccept,
      })
    ) {
      this.api.removeBot(channel).subscribe(() => {
        this.snackbar.info(T.bots.removed(CHANNEL_NAMES[channel]));
        this.reload();
        this.changed.emit();
      });
    }
  }

  /** Reloads the bots (e.g. after the teacher connected or disconnected their own account). */
  reload(): void {
    this.api.bots().subscribe((bots) => {
      this.bots.set(bots);
    });
  }
}
