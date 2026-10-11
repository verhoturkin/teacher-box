import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelSetup, ChannelType } from '../data-access/notifications.models';
import { CHANNEL_ICONS, CHANNEL_NAMES, CONNECTION_TAGS } from '../notification-labels';
import { BotWizardDialog } from './bot-wizard-dialog';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';

/** Teacher: messenger bots of the instance — connect with a wizard, check, remove. */
@Component({
  selector: 'tb-bots-panel',
  imports: [Button, Card, ConfirmDialog, Tag, BotWizardDialog, Tooltip],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
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
            <div class="tb-list__trail">
              @if (bot.configured) {
                @let tag = tags[bot.connection.connection];
                <p-tag [value]="tag.value" [severity]="tag.severity" />
                <p-button
                  [label]="bot.teacherLinked ? t.check : t.setUp"
                  icon="pi pi-cog"
                  severity="secondary"
                  [text]="true"
                  (onClick)="open(bot)"
                />
                @if (!bot.fromEnvironment) {
                  <p-button
                    icon="pi pi-trash"
                    [text]="true"
                    [pTooltip]="t.remove(names[bot.channel])"
                    [rounded]="true"
                    severity="danger"
                    [ariaLabel]="t.remove(names[bot.channel])"
                    (onClick)="confirmRemove(bot.channel)"
                  />
                }
              } @else {
                <p-button
                  [label]="t.connect"
                  severity="secondary"
                  icon="pi pi-plus"
                  (onClick)="open(bot)"
                />
              }
            </div>
          </li>
        }
      </ul>
    </p-card>

    <tb-bot-wizard-dialog
      [visible]="wizardVisible()"
      (visibleChange)="onWizardVisibleChange($event)"
      [channel]="wizardChannel()"
      [setup]="wizardSetup()"
      (changed)="onChanged($event)"
    />
    <p-confirmdialog appendTo="body" />
  `,
  styles: `
    .tb-bots {
      margin-top: var(--tb-space-4);
    }

    .tb-bot__error {
      color: var(--p-md-error);
    }
  `,
})
export class BotsPanel implements OnInit {
  protected readonly t = T.bots;
  private readonly api = inject(NotificationsApi);
  private readonly confirmation = inject(ConfirmationService);
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

  ngOnInit(): void {
    this.reload();
  }

  open(bot: ChannelSetup): void {
    this.wizardChannel.set(bot.channel);
    this.wizardSetup.set(bot);
    this.wizardVisible.set(true);
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

  confirmRemove(channel: ChannelType): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.bots.removeHeader,
        message: T.bots.removeMessage(CHANNEL_NAMES[channel]),
        acceptLabel: T.bots.removeAccept,
        accept: () => {
          this.api.removeBot(channel).subscribe(() => {
            this.snackbar.info(T.bots.removed(CHANNEL_NAMES[channel]));
            this.reload();
            this.changed.emit();
          });
        },
      }),
    );
  }

  /** Reloads the bots (e.g. after the teacher connected or disconnected their own account). */
  reload(): void {
    this.api.bots().subscribe((bots) => {
      this.bots.set(bots);
    });
  }
}
