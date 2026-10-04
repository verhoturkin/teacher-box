import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { HelpButton } from '@features/help/parts';
import { AiApi } from '@features/ai/parts';
import { MeetingsSettingsPanel } from '@features/meetings/parts';
import { GoogleCalendarPanel } from '@features/schedule/parts';
import { RowType } from '@shared/ui/row-type.directive';
import { BackupsCard } from './backups/backups-card';
import { SettingsApi } from './data-access/settings-api';
import { PortalSettingsCard } from './portal-settings-card';
import { ResetCard } from './reset-card';
import {
  FailedDelivery,
  MessengerStatus,
  MessengerType,
  NotificationsStatus,
} from './data-access/settings.models';
import { PageHeader } from '@shared/ui/page-header';
import { EmptyState } from '@shared/ui/empty-state';

export const MESSENGERS: { readonly type: MessengerType; readonly name: string }[] = [
  { type: 'TELEGRAM', name: 'Telegram' },
  { type: 'VK', name: 'ВКонтакте' },
  { type: 'MAX', name: 'MAX' },
];

/** Teacher: the portal, integrations, delivery problems, backups and a link to the profile. */
@Component({
  selector: 'tb-settings-page',
  imports: [
    HelpButton,
    DatePipe,
    RouterLink,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    GoogleCalendarPanel,
    MeetingsSettingsPanel,
    PortalSettingsCard,
    BackupsCard,
    ResetCard,
    TableModule,
    Tag,
    RowType,
    PageHeader,
    EmptyState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Настройки">
      <tb-help-button help topic="teacher/settings" />
    </tb-page-header>
    <div class="tb-stack tb-stack--narrow">
      <tb-portal-settings-card />
      <p-card header="Интеграции">
        <ul class="tb-list">
          @for (messenger of messengers; track messenger.type) {
            @let state = messengerStatus(messenger.type);
            <li>
              <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-comments"></i></span>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ messenger.name }}</span>
              </div>
              <div class="tb-list__trail">
                @switch (state?.connection) {
                  @case ('OK') {
                    <p-tag value="Работает" severity="success" />
                  }
                  @case ('PENDING') {
                    <p-tag value="Подключается" severity="info" />
                  }
                  @case ('ERROR') {
                    <p-tag value="Нет связи" severity="danger" />
                  }
                  @default {
                    <p-tag value="Не настроен" severity="secondary" />
                    <a
                      routerLink="/teacher/notifications"
                      [queryParams]="{ open: 'messengers' }"
                      fragment="notifications-messengers"
                      >подключить</a
                    >
                  }
                }
              </div>
            </li>
            @if (state?.connection === 'ERROR') {
              <li class="tb-integration-error">
                <small class="tb-list__supporting">
                  {{ state?.error }}
                  @if (messenger.type === 'TELEGRAM') {
                    <br />Если Telegram заблокирован в сети сервера, попросите администратора
                    указать прокси в его настройках.
                  }
                </small>
              </li>
            }
          }
          <li>
            <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-sparkles"></i></span>
            <div class="tb-list__text">
              <span class="tb-list__title">ИИ-помощник</span>
            </div>
            <div class="tb-list__trail">
              @if (aiModel(); as model) {
                <p-tag [value]="model" severity="success" />
              } @else {
                <p-tag value="Не настроен" severity="secondary" />
              }
              <a routerLink="/teacher/ai">подробнее</a>
            </div>
          </li>
        </ul>
        <small class="tb-hint">
          Ботов мессенджеров можно подключить в разделе
          <a
            routerLink="/teacher/notifications"
            [queryParams]="{ open: 'messengers' }"
            fragment="notifications-messengers"
            >«Уведомления» → «Мессенджеры»</a
          >. ИИ-помощник настраивает администратор портала.
        </small>
      </p-card>

      <tb-google-calendar-panel />

      <tb-meetings-settings-panel />

      <p-card header="Неудачные доставки уведомлений">
        @if (failed().length === 0) {
          <tb-empty-state icon="pi-check-circle" title="Все уведомления доставлены" />
        } @else {
          <p-table [value]="failed()" styleClass="tb-cards">
            <ng-template #header>
              <tr>
                <th>Когда</th>
                <th>Кому</th>
                <th>Куда</th>
                <th>Ошибка</th>
              </tr>
            </ng-template>
            <ng-template #body let-row [tbRowType]="failed()">
              <tr>
                <td data-label="Когда">{{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }}</td>
                <td data-label="Кому">{{ row.recipientName ?? 'Вы' }}</td>
                <td data-label="Куда">{{ messengerName(row) }}</td>
                <td data-label="Ошибка" class="tb-error-cell tb-cell-wide">
                  {{ row.error ?? '—' }}
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>

      <tb-backups-card />
      <tb-reset-card />

      <p-card header="Профиль">
        <a pButton routerLink="/teacher/account" severity="secondary">
          <i pButtonIcon aria-hidden="true" class="pi pi-id-card"></i>
          <span pButtonLabel>Мой аккаунт и пароль</span>
        </a>
      </p-card>
    </div>
  `,
  styles: `
    .tb-integrations {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0 0 var(--tb-space-4);
      padding: 0;
      list-style: none;

      li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--tb-space-1) var(--tb-space-3);
      }

      li > span:first-child {
        min-width: 9rem;
      }

      /* On a phone the name keeps its line: the states at the right edge, the link before them */
      @media (width <= 30em) {
        li > span:first-child {
          flex: 1;
          min-width: 0;
        }

        li > p-tag {
          order: 1;
        }
      }
    }

    .tb-integration-error {
      overflow-wrap: anywhere;
      color: var(--p-md-error);
    }

    .tb-error-cell {
      overflow-wrap: anywhere;
    }
  `,
})
export class SettingsPage implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly ai = inject(AiApi);

  protected readonly messengers = MESSENGERS;
  protected readonly status = signal<NotificationsStatus | null>(null);
  protected readonly failed = signal<FailedDelivery[]>([]);
  protected readonly aiModel = signal<string | null>(null);

  ngOnInit(): void {
    this.api.notificationsStatus().subscribe((status) => {
      this.status.set(status);
      this.failed.set(status.failedDeliveries);
    });
    this.ai.status().subscribe((status) => {
      this.aiModel.set(status.enabled ? status.model : null);
    });
  }

  protected messengerStatus(type: MessengerType): MessengerStatus | null {
    return this.status()?.channels.find((status) => status.channel === type) ?? null;
  }

  protected messengerName(row: FailedDelivery): string {
    return MESSENGERS.find((messenger) => messenger.type === row.channel)?.name ?? row.channel;
  }
}
