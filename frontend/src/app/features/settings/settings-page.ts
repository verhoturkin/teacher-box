import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { AiApi } from '@features/ai/parts';
import { GoogleCalendarPanel } from '@features/schedule/parts';
import { FileSaver } from '@shared/files/file-saver';
import { formatFileSize } from '@shared/files/file-size';
import { RowType } from '@shared/ui/row-type.directive';
import { SettingsApi } from './data-access/settings-api';
import {
  BackupInfo,
  FailedDelivery,
  MessengerStatus,
  MessengerType,
  NotificationsStatus,
} from './data-access/settings.models';

export const MESSENGERS: { readonly type: MessengerType; readonly name: string }[] = [
  { type: 'TELEGRAM', name: 'Telegram' },
  { type: 'VK', name: 'ВКонтакте' },
  { type: 'MAX', name: 'MAX' },
];

/** Teacher: integrations, delivery problems, backups and a link to the profile. */
@Component({
  selector: 'tb-settings-page',
  imports: [
    DatePipe,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Card,
    ConfirmDialog,
    GoogleCalendarPanel,
    TableModule,
    Tag,
    RowType,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Настройки</h1>
    <div class="tb-stack">
      <p-card header="Интеграции">
        <ul class="tb-integrations">
          @for (messenger of messengers; track messenger.type) {
            @let state = messengerStatus(messenger.type);
            <li>
              <span>{{ messenger.name }}</span>
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
                  <a routerLink="/teacher/notifications" [queryParams]="{ tab: 'messengers' }">подключить</a>
                }
              }
            </li>
            @if (state?.connection === 'ERROR') {
              <li class="tb-integration-error">
                <small>
                  {{ state?.error }}
                  @if (messenger.type === 'TELEGRAM') {
                    <br />Если Telegram заблокирован в сети сервера, укажите прокси в
                    TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY.
                  }
                </small>
              </li>
            }
          }
          <li>
            <span>ИИ-помощник</span>
            @if (aiModel(); as model) {
              <p-tag [value]="model" severity="success" />
            } @else {
              <p-tag value="Не настроен" severity="secondary" />
            }
            <a routerLink="/teacher/ai">подробнее</a>
          </li>
        </ul>
        <small class="tb-hint">
          Ботов мессенджеров можно подключить в разделе
          <a routerLink="/teacher/notifications" [queryParams]="{ tab: 'messengers' }">«Уведомления» → «Мессенджеры»</a>. ИИ-помощник
          настраивается переменными окружения сервера (см. .env.example).
        </small>
      </p-card>

      <tb-google-calendar-panel />

      <p-card header="Неудачные доставки уведомлений">
        @if (failed().length === 0) {
          <p class="tb-muted">Все уведомления доставлены.</p>
        } @else {
          <p-table [value]="failed()" styleClass="p-datatable-sm">
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
                <td>{{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }}</td>
                <td>{{ row.recipientName ?? 'Вы' }}</td>
                <td>{{ messengerName(row) }}</td>
                <td class="tb-error-cell">{{ row.error ?? '—' }}</td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>

      <p-card header="Резервные копии">
        <p class="tb-muted">
          Копия базы данных и файлов создаётся автоматически каждую ночь; хранятся последние копии.
          Чтобы восстановить копию, положите архив в папку данных <code>restore/</code> и перезапустите портал.
        </p>
        <div class="tb-actions">
          <p-button label="Создать копию сейчас" icon="pi pi-database" [loading]="creating()" (onClick)="create()" />
        </div>
        @if (backups().length === 0) {
          <p class="tb-muted">Копий пока нет.</p>
        } @else {
          <p-table [value]="backups()" styleClass="p-datatable-sm">
            <ng-template #header>
              <tr>
                <th>Создана</th>
                <th>Размер</th>
                <th></th>
              </tr>
            </ng-template>
            <ng-template #body let-backup [tbRowType]="backups()">
              <tr>
                <td>{{ backup.createdAt | date: 'dd.MM.yyyy HH:mm' }}</td>
                <td>{{ size(backup) }}</td>
                <td class="tb-row-actions">
                  <p-button
                    icon="pi pi-download"
                    [text]="true"
                    [ariaLabel]="'Скачать ' + backup.name"
                    (onClick)="download(backup)"
                  />
                  <p-button
                    icon="pi pi-trash"
                    [text]="true"
                    severity="danger"
                    [ariaLabel]="'Удалить ' + backup.name"
                    (onClick)="confirmDelete(backup)"
                  />
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>

      <p-card header="Профиль">
        <a pButton routerLink="/teacher/account" [outlined]="true">
          <i pButtonIcon class="pi pi-id-card"></i>
          <span pButtonLabel>Мой аккаунт и пароль</span>
        </a>
      </p-card>
    </div>
    <p-confirmdialog />
  `,
  styles: `
    .tb-integrations {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0 0 1rem;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      span {
        min-width: 9rem;
      }
    }

    .tb-integration-error {
      overflow-wrap: anywhere;
      color: var(--p-red-500);
    }

    .tb-error-cell {
      overflow-wrap: anywhere;
    }

    .tb-row-actions {
      text-align: right;
      white-space: nowrap;
    }
  `,
})
export class SettingsPage implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly ai = inject(AiApi);
  private readonly fileSaver = inject(FileSaver);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  protected readonly messengers = MESSENGERS;
  protected readonly status = signal<NotificationsStatus | null>(null);
  protected readonly failed = signal<FailedDelivery[]>([]);
  protected readonly aiModel = signal<string | null>(null);
  protected readonly backups = signal<BackupInfo[]>([]);
  protected readonly creating = signal(false);

  ngOnInit(): void {
    this.api.notificationsStatus().subscribe((status) => {
      this.status.set(status);
      this.failed.set(status.failedDeliveries);
    });
    this.ai.status().subscribe((status) => {
      this.aiModel.set(status.enabled ? status.model : null);
    });
    this.reloadBackups();
  }

  protected messengerStatus(type: MessengerType): MessengerStatus | null {
    return this.status()?.channels.find((status) => status.channel === type) ?? null;
  }

  protected messengerName(row: FailedDelivery): string {
    return MESSENGERS.find((messenger) => messenger.type === row.channel)?.name ?? row.channel;
  }

  protected size(backup: BackupInfo): string {
    return formatFileSize(backup.size);
  }

  create(): void {
    this.creating.set(true);
    this.api.createBackup().subscribe({
      next: (backup) => {
        this.creating.set(false);
        this.messages.add({ severity: 'success', summary: 'Готово', detail: `Копия ${backup.name} создана` });
        this.reloadBackups();
      },
      error: () => {
        this.creating.set(false);
      },
    });
  }

  download(backup: BackupInfo): void {
    this.api.downloadBackup(backup.name).subscribe((blob) => {
      this.fileSaver.save(blob, backup.name);
    });
  }

  confirmDelete(backup: BackupInfo): void {
    this.confirmation.confirm({
      header: 'Удалить копию?',
      message: `Резервная копия ${backup.name} будет удалена без возможности восстановления.`,
      acceptLabel: 'Удалить',
      rejectLabel: 'Отмена',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.deleteBackup(backup.name).subscribe(() => {
          this.reloadBackups();
        });
      },
    });
  }

  private reloadBackups(): void {
    this.api.backups().subscribe((backups) => {
      this.backups.set(backups);
    });
  }
}
