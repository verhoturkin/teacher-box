import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tag } from 'primeng/tag';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelSetup, ChannelType } from '../data-access/notifications.models';
import { CHANNEL_ICONS, CHANNEL_NAMES, CONNECTION_TAGS } from '../notification-labels';
import { BotWizardDialog } from './bot-wizard-dialog';

/** Teacher: messenger bots of the instance — connect with a wizard, check, remove. */
@Component({
  selector: 'tb-bots-panel',
  imports: [Button, Card, ConfirmDialog, Tag, BotWizardDialog],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Боты мессенджеров">
      <p class="tb-muted">
        Через ботов уведомления приходят вам и ученикам в Telegram, ВКонтакте или MAX. Достаточно одного мессенджера —
        того, которым пользуются ваши ученики.
      </p>
      <ul class="tb-bots">
        @for (bot of bots(); track bot.channel) {
          <li class="tb-bot">
            <i [class]="icons[bot.channel]" aria-hidden="true"></i>
            <div class="tb-bot__info">
              <strong>{{ names[bot.channel] }}</strong>
              @if (bot.configured) {
                <small class="tb-muted">
                  {{ bot.botName ?? 'бот из настроек сервера' }}
                  @if (!bot.teacherLinked) {
                    · ваш аккаунт не подключён
                  }
                </small>
                @if (bot.connection.connection === 'ERROR') {
                  <small class="tb-bot__error">
                    {{ bot.connection.error }}
                    @if (bot.channel === 'TELEGRAM') {
                      Если Telegram заблокирован в сети сервера, укажите прокси в TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY.
                    }
                  </small>
                }
              } @else {
                <small class="tb-muted">не подключён</small>
              }
            </div>
            @if (bot.configured) {
              @let tag = tags[bot.connection.connection];
              <p-tag [value]="tag.value" [severity]="tag.severity" />
              <p-button
                [label]="bot.teacherLinked ? 'Проверить' : 'Настроить'"
                icon="pi pi-cog"
                size="small"
                [outlined]="true"
                (onClick)="open(bot)"
              />
              @if (!bot.fromEnvironment) {
                <p-button
                  icon="pi pi-trash"
                  [text]="true"
                  severity="danger"
                  [ariaLabel]="'Отключить бота ' + names[bot.channel]"
                  (onClick)="confirmRemove(bot.channel)"
                />
              }
            } @else {
              <p-button label="Подключить" icon="pi pi-plus" size="small" (onClick)="open(bot)" />
            }
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
    <p-confirmdialog />
  `,
  styles: `
    .tb-bots {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-bot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;

      > i {
        font-size: 1.5rem;
        color: var(--p-primary-color);
      }
    }

    .tb-bot__info {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 12rem;
    }

    .tb-bot__error {
      overflow-wrap: anywhere;
      color: var(--p-red-500);
    }
  `,
})
export class BotsPanel implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

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
    this.confirmation.confirm({
      header: 'Отключить бота?',
      message: `Уведомления перестанут приходить в ${CHANNEL_NAMES[channel]}. Подключения учеников сохранятся и заработают снова, если подключить этого же бота.`,
      acceptLabel: 'Отключить',
      rejectLabel: 'Отмена',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.removeBot(channel).subscribe(() => {
          this.messages.add({ severity: 'info', summary: 'Отключено', detail: `Бот ${CHANNEL_NAMES[channel]} отключён` });
          this.reload();
          this.changed.emit();
        });
      },
    });
  }

  /** Reloads the bots (e.g. after the teacher connected or disconnected their own account). */
  reload(): void {
    this.api.bots().subscribe((bots) => {
      this.bots.set(bots);
    });
  }
}
