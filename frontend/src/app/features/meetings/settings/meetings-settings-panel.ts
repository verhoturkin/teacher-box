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
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { Portal } from '@core/portal/portal';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { MeetingsApi } from '../data-access/meetings-api';
import { YandexStatus } from '../data-access/meetings.models';
import { MeetingPreferences } from '../telemost';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';

type Severity = 'success' | 'info' | 'warn' | 'error';

/** Messages for the result Yandex's redirect brings back (`?yandex=...`). */
export const YANDEX_RESULTS: Readonly<Record<string, { severity: Severity; text: string }>> = {
  connected: { severity: 'success', text: 'Яндекс подключён: комнаты можно создавать кнопкой.' },
  denied: { severity: 'warn', text: 'Доступ к Телемосту не предоставлен.' },
  expired: {
    severity: 'warn',
    text: 'Ссылка подключения устарела — нажмите «Подключить Яндекс» ещё раз.',
  },
  failed: { severity: 'error', text: 'Не удалось подключить Яндекс.' },
};

/**
 * Video meetings in Yandex Telemost: connecting the teacher's Yandex account step by step (an
 * application in Yandex ID), the waiting room, and opening meetings in the desktop application.
 */
@Component({
  selector: 'tb-meetings-settings-panel',
  imports: [
    HelpButton,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    Button,
    Card,
    InputText,
    Message,
    Password,
    Tag,
    ToggleSwitch,
    Tooltip,
    PasswordToggle,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="meetings">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >Видеовстречи (Яндекс Телемост) <tb-help-button topic="teacher/meetings"
          /></span>
        </div>
      </ng-template>
      @if (result(); as result) {
        <p-message [severity]="result.severity" styleClass="tb-form-message">{{
          result.text
        }}</p-message>
      }
      <p>
        У каждого ученика и у каждой группы — постоянная ссылка на встречу: её задают в разделе
        «Ученики» (строка «Видеовстреча» в карточке). Можно создать встречу в Телемосте самим и
        вставить ссылку, а можно подключить Яндекс — тогда встречи создаются кнопкой.
      </p>
      @if (status(); as status) {
        @if (status.tokenFromEnvironment) {
          <div class="tb-meetings-state">
            <p-tag value="Подключён" severity="success" />
            <span class="tb-muted">токеном, который задал администратор портала</span>
          </div>
        } @else if (status.status === 'CONNECTED') {
          <div class="tb-meetings-state">
            <p-tag value="Яндекс подключён" severity="success" />
            <span class="tb-muted">с {{ status.connectedAt | date: 'dd.MM.yyyy HH:mm' }}</span>
          </div>
          <p-button
            label="Отключить"
            severity="danger"
            [text]="true"
            [loading]="busy.is('disconnect')"
            (onClick)="disconnect()"
          />
        } @else {
          @if (status.status === 'NEEDS_RECONNECT') {
            <p-message severity="warn" styleClass="tb-form-message">
              Яндекс больше не принимает доступ портала. Подключите аккаунт заново.
            </p-message>
          }
          @if (status.lastError !== null) {
            <p class="tb-error">{{ status.lastError }}</p>
          }
          @if (status.clientConfigured && !editingClient()) {
            <div class="tb-actions">
              <p-button
                label="Подключить Яндекс"
                severity="secondary"
                icon="pi pi-video"
                [loading]="pending()"
                (onClick)="connect()"
              />
              @if (!status.clientFromEnvironment) {
                <p-button
                  label="Изменить приложение"
                  severity="secondary"
                  [text]="true"
                  (onClick)="editingClient.set(true)"
                />
              }
            </div>
          } @else {
            <ol class="tb-meetings-steps">
              <li>
                Откройте
                <a href="https://oauth.yandex.ru/client/new" target="_blank" rel="noopener"
                  >oauth.yandex.ru</a
                >
                под аккаунтом, в котором вы проводите встречи, и создайте приложение для
                веб-сервисов.
              </li>
              <li>В доступах выберите Телемост: создание, просмотр и изменение встреч.</li>
              <li>
                В поле Redirect URI укажите:
                <div class="tb-meetings-uri">
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
              </li>
              <li>Скопируйте сюда ClientID и Client secret приложения.</li>
            </ol>
            <form tbFieldErrors class="tb-form" [formGroup]="form" (ngSubmit)="saveClient()">
              <div class="tb-field">
                <label for="yandex-client-id">ClientID</label>
                <input
                  pInputText
                  id="yandex-client-id"
                  formControlName="clientId"
                  autocomplete="off"
                />
              </div>
              <div class="tb-field">
                <label for="yandex-client-secret">Client secret</label>
                <p-password
                  inputId="yandex-client-secret"
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
                    severity="secondary"
                    [text]="true"
                    (onClick)="editingClient.set(false)"
                  />
                }
                <p-button
                  class="tb-tonal"
                  type="submit"
                  label="Сохранить"
                  severity="success"
                  [loading]="pending()"
                />
              </div>
            </form>
          }
        }
        <div class="tb-meetings-options">
          <label class="tb-switch" for="meetings-waiting-room">
            <p-toggleswitch
              inputId="meetings-waiting-room"
              [ngModel]="status.waitingRoom"
              (ngModelChange)="setWaitingRoom($event)"
            />
            Зал ожидания: ученики ждут, пока вы их впустите (для новых встреч)
          </label>
          <label class="tb-switch" for="meetings-open-in-app">
            <p-toggleswitch
              inputId="meetings-open-in-app"
              [ngModel]="openInApp()"
              (ngModelChange)="setOpenInApp($event)"
            />
            Открывать встречи Телемоста в приложении на этом компьютере
          </label>
        </div>
      }
    </p-card>
  `,
  styles: `
    .tb-meetings-state {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      margin-bottom: var(--tb-space-2);
    }

    .tb-meetings-steps {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      padding-left: var(--tb-space-5);
    }

    .tb-meetings-uri {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      margin: var(--tb-space-1) 0;

      code {
        overflow-wrap: anywhere;
      }
    }

    .tb-meetings-options {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin-top: var(--tb-space-4);
    }
  `,
})
export class MeetingsSettingsPanel implements OnInit {
  protected readonly busy = new Busy();
  private readonly api = inject(MeetingsApi);
  private readonly navigation = inject(ExternalNavigation);
  private readonly portal = inject(Portal);
  private readonly clipboard = inject(Clipboard);
  private readonly snackbar = inject(Snackbar);
  private readonly route = inject(ActivatedRoute);
  private readonly preferences = inject(MeetingPreferences);

  protected readonly status = signal<YandexStatus | null>(null);
  protected readonly pending = signal(false);
  protected readonly editingClient = signal(false);
  protected readonly openInApp = this.preferences.openInApp;
  protected readonly result = computed(() => {
    const code = this.resultCode();
    return code === null ? null : (YANDEX_RESULTS[code] ?? null);
  });
  protected readonly redirectUri = computed(() =>
    this.portal.link(this.status()?.callbackPath ?? '/api/public/meetings/yandex/callback'),
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
    this.resultCode.set(this.route.snapshot.queryParamMap.get('yandex'));
    this.load();
  }

  saveClient(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.api.saveClient(value.clientId.trim(), value.clientSecret.trim()).subscribe({
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
    this.api.authorize(this.navigation.origin()).subscribe({
      next: (url) => {
        this.navigation.go(url);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  disconnect(): void {
    this.busy.guard('disconnect', this.api.disconnect()).subscribe(() => {
      this.resultCode.set(null);
      this.load();
    });
  }

  setWaitingRoom(enabled: boolean): void {
    this.api.setWaitingRoom(enabled).subscribe((status) => {
      this.status.set(status);
    });
  }

  setOpenInApp(enabled: boolean): void {
    this.preferences.setOpenInApp(enabled);
  }

  copy(text: string): void {
    if (this.clipboard.copy(text)) {
      this.snackbar.success('Адрес в буфере обмена');
    }
  }

  private load(): void {
    this.api.yandexStatus().subscribe((status) => {
      this.status.set(status);
    });
  }
}
