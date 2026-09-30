import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { Portal } from '@core/portal/portal';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { ScheduleApi } from '../data-access/schedule-api';
import { GoogleCalendarStatus } from '../data-access/schedule.models';
import { PasswordToggle } from '@shared/ui/password-toggle';

type Severity = 'success' | 'info' | 'warn' | 'error';

/** Messages for the result Google's redirect brings back (`?google=...`). */
export const AUTHORIZATION_RESULTS: Readonly<Record<string, { severity: Severity; text: string }>> =
  {
    connected: {
      severity: 'success',
      text: 'Google Календарь подключён. Занятия появятся в нём в течение минуты.',
    },
    denied: { severity: 'warn', text: 'Доступ к календарю не предоставлен.' },
    expired: {
      severity: 'warn',
      text: 'Ссылка подключения устарела — нажмите «Подключить Google» ещё раз.',
    },
    failed: { severity: 'error', text: 'Не удалось подключить Google Календарь.' },
  };

/**
 * The teacher's Google Calendar: step-by-step setup of an OAuth client in Google Cloud, connecting
 * with Google's consent page, the sync state and disconnecting.
 */
@Component({
  selector: 'tb-google-calendar-panel',
  imports: [
    HelpButton,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    Button,
    Card,
    Checkbox,
    InputText,
    Message,
    Password,
    Tag,
    Tooltip,
    PasswordToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="google">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >Google Календарь <tb-help-button topic="teacher/calendars"
          /></span>
        </div>
      </ng-template>
      @if (result(); as result) {
        <p-message [severity]="result.severity" styleClass="tb-form-message">{{
          result.text
        }}</p-message>
      }
      @if (status(); as status) {
        @switch (status.status) {
          @case ('CONNECTED') {
            <div class="tb-google-state">
              <p-tag value="Подключён" severity="success" />
              <span class="tb-muted">с {{ status.connectedAt | date: 'dd.MM.yyyy HH:mm' }}</span>
            </div>
            <p>Занятия попадают в отдельный календарь портала в вашем Google Календаре.</p>
            @if (status.lastSyncAt !== null) {
              <small class="tb-muted"
                >Последняя синхронизация: {{ status.lastSyncAt | date: 'dd.MM.yyyy HH:mm' }}</small
              >
            }
            @if (status.busyEnabled) {
              <p class="tb-muted">
                Занятость из вашего основного календаря показывается в расписании.
              </p>
            }
            @if (status.lastError !== null) {
              <p class="tb-error">{{ status.lastError }}</p>
            }
            <div class="tb-actions">
              <p-button
                label="Синхронизировать сейчас"
                icon="pi pi-refresh"
                severity="secondary"
                [loading]="pending()"
                (onClick)="sync()"
              />
              <p-button
                label="Отключить"
                severity="danger"
                [text]="true"
                (onClick)="disconnect()"
              />
            </div>
          }
          @default {
            @if (status.status === 'NEEDS_RECONNECT') {
              <p-message severity="warn" styleClass="tb-form-message">
                Google больше не принимает доступ портала. Подключите календарь заново.
              </p-message>
            }
            @if (status.clientConfigured && !editingClient()) {
              <p>
                Портал создаст в вашем Google Календаре отдельный календарь «{{ portalName() }}» и
                будет добавлять в него занятия. Другие календари он не читает и не меняет.
              </p>
              <label class="tb-switch" for="google-busy">
                <p-checkbox [(ngModel)]="busy" [binary]="true" inputId="google-busy" />
                <span>Показывать в расписании занятость из моего календаря</span>
              </label>
              @if (status.lastError !== null) {
                <p class="tb-error">{{ status.lastError }}</p>
              }
              <div class="tb-actions">
                <p-button
                  label="Подключить Google"
                  severity="secondary"
                  icon="pi pi-google"
                  [loading]="pending()"
                  (onClick)="connect()"
                />
                @if (!status.clientFromEnvironment) {
                  <p-button
                    label="Изменить OAuth-клиент"
                    severity="secondary"
                    [text]="true"
                    (onClick)="editingClient.set(true)"
                  />
                }
              </div>
            } @else {
              <ol class="tb-google-steps">
                <li>
                  Откройте
                  <a href="https://console.cloud.google.com/" target="_blank" rel="noopener"
                    >Google Cloud Console</a
                  >
                  и создайте проект.
                </li>
                <li>
                  «APIs &amp; Services» → «Library»: включите <strong>Google Calendar API</strong>.
                </li>
                <li>
                  «Google Auth Platform»: тип аудитории <strong>External</strong>, добавьте свой
                  адрес в тестовые пользователи, затем нажмите <strong>Publish app</strong> — иначе
                  Google отзывает доступ через 7 дней. Предупреждение «приложение не проверено» для
                  личного использования можно пропустить.
                </li>
                <li>
                  «Clients» → «Create client» → <strong>Web application</strong>. В «Authorized
                  redirect URIs» добавьте:
                  <div class="tb-google-uri">
                    <code>{{ redirectUri() }}</code>
                    <p-button
                      icon="pi pi-copy"
                      [text]="true"
                      pTooltip="Копировать адрес"
                      [rounded]="true"
                      severity="secondary"
                      ariaLabel="Копировать адрес"
                      (onClick)="copy(redirectUri())"
                    />
                  </div>
                  <small class="tb-muted"
                    >Нужен HTTPS-адрес портала. Без него подключите календарь один раз, открыв
                    портал по http://localhost (например, через SSH-туннель).</small
                  >
                </li>
                <li>Скопируйте Client ID и Client secret сюда.</li>
              </ol>
              <form class="tb-form" [formGroup]="form" (ngSubmit)="saveClient()">
                <div class="tb-field">
                  <label for="google-client-id">Client ID</label>
                  <input
                    pInputText
                    id="google-client-id"
                    formControlName="clientId"
                    autocomplete="off"
                  />
                </div>
                <div class="tb-field">
                  <label for="google-client-secret">Client secret</label>
                  <p-password
                    inputId="google-client-secret"
                    formControlName="clientSecret"
                    [feedback]="false"
                    [toggleMask]="true"
                    [fluid]="true"
                  >
                    <ng-template #showicon><tb-password-toggle /></ng-template>
                    <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
                  </p-password>
                </div>
                <div class="tb-form-actions">
                  @if (status.clientConfigured) {
                    <p-button
                      label="Отмена"
                      severity="danger"
                      [text]="true"
                      (onClick)="editingClient.set(false)"
                    />
                  }
                  <p-button
                    class="tb-tonal"
                    type="submit"
                    label="Сохранить"
                    severity="success"
                    [disabled]="form.invalid"
                    [loading]="pending()"
                  />
                </div>
              </form>
            }
          }
        }
      }
    </p-card>
  `,
  styles: `
    .tb-google-state {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      margin-bottom: var(--tb-space-3);
    }

    .tb-google-steps {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      padding-left: var(--tb-space-5);
    }

    .tb-google-uri {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      margin: var(--tb-space-1) 0;

      code {
        overflow-wrap: anywhere;
      }
    }

    .tb-actions {
      margin-top: var(--tb-space-3);
    }
  `,
})
export class GoogleCalendarPanel implements OnInit {
  private readonly api = inject(ScheduleApi);
  private readonly navigation = inject(ExternalNavigation);
  private readonly portal = inject(Portal);

  protected readonly portalName = this.portal.name;
  private readonly clipboard = inject(Clipboard);
  private readonly messages = inject(MessageService);
  private readonly route = inject(ActivatedRoute);

  protected readonly status = signal<GoogleCalendarStatus | null>(null);
  protected readonly pending = signal(false);
  protected readonly editingClient = signal(false);
  protected readonly busy = signal(false);
  protected readonly result = computed(() => {
    const code = this.resultCode();
    return code === null ? null : (AUTHORIZATION_RESULTS[code] ?? null);
  });
  protected readonly redirectUri = computed(() =>
    this.portal.link(this.status()?.callbackPath ?? '/api/public/schedule/google/callback'),
  );

  readonly form = new FormGroup({
    clientId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
    clientSecret: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
  });

  private readonly resultCode = signal<string | null>(null);

  ngOnInit(): void {
    this.resultCode.set(this.route.snapshot.queryParamMap.get('google'));
    this.load();
  }

  saveClient(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.api.saveGoogleClient(value.clientId.trim(), value.clientSecret.trim()).subscribe({
      next: (status) => {
        this.pending.set(false);
        this.editingClient.set(false);
        this.form.reset();
        this.status.set(status);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  connect(): void {
    this.pending.set(true);
    this.api.authorizeGoogle(this.navigation.origin(), this.busy()).subscribe({
      next: (response) => {
        this.navigation.go(response.url);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  sync(): void {
    this.pending.set(true);
    this.api.syncGoogle().subscribe({
      next: (response) => {
        this.pending.set(false);
        this.messages.add({
          severity: 'success',
          summary: 'Готово',
          detail: `Изменено событий: ${String(response.changed)}`,
        });
        this.load();
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  disconnect(): void {
    this.api.disconnectGoogle().subscribe(() => {
      this.resultCode.set(null);
      this.load();
    });
  }

  copy(text: string): void {
    if (this.clipboard.copy(text)) {
      this.messages.add({
        severity: 'success',
        summary: 'Скопировано',
        detail: 'Адрес в буфере обмена',
      });
    }
  }

  private load(): void {
    this.api.googleStatus().subscribe((status) => {
      this.status.set(status);
      this.busy.set(status.busyEnabled);
    });
  }
}
