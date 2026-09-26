import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { Subscription, interval, switchMap } from 'rxjs';
import { describeError } from '@core/http/error-messages';
import { isProblemDetail, problemCode } from '@core/http/problem-detail';
import { LINK_POLL_INTERVAL_MS } from '../channels/channels-panel';
import { LinkCodeView } from '../channels/link-code-view';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelSetup, ChannelType, LinkCode } from '../data-access/notifications.models';
import { CHANNEL_NAMES } from '../notification-labels';

/** Wizard steps: create a bot, check its token, connect the teacher's account, send a test message. */
export type WizardStep = 1 | 2 | 3 | 4;

/** Errors whose detail is the messenger's own answer, worth showing to the teacher. */
const MESSENGER_ERRORS = new Set(['notifications.channel-check-failed', 'notifications.test-failed']);

function describeMessengerError(error: unknown, fallback: string): string {
  const message = describeError(error, fallback);
  const code = problemCode(error);
  if (code !== null && MESSENGER_ERRORS.has(code) && error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (isProblemDetail(body) && body.detail !== undefined && body.detail !== '') {
      return `${message}. Ответ мессенджера: ${body.detail}`;
    }
  }
  return message;
}

/** Teacher: connects a messenger bot step by step, without editing the server configuration. */
@Component({
  selector: 'tb-bot-wizard-dialog',
  imports: [ReactiveFormsModule, Button, Dialog, InputNumber, LinkCodeView, Message, Password],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="'Подключение ' + name()"
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: '40rem' }"
      [breakpoints]="{ '640px': '95vw' }"
      [draggable]="false"
    >
      <ol class="tb-wizard">
        <li class="tb-wizard__step" [class.tb-wizard__step--active]="step() === 1" [class.tb-wizard__step--done]="step() > 1">
          <button type="button" class="tb-wizard__header" (click)="go(1)">
            <span class="tb-wizard__number">1</span>
            <span>Создайте бота</span>
          </button>
          @if (step() === 1) {
            <div class="tb-wizard__body">
              @switch (channel()) {
                @case ('TELEGRAM') {
                  <ol class="tb-wizard__howto">
                    <li>
                      Откройте <a href="https://t.me/BotFather" target="_blank" rel="noopener">&#64;BotFather</a> в Telegram и
                      отправьте команду <code>/newbot</code>.
                    </li>
                    <li>Придумайте имя бота и его адрес — адрес должен заканчиваться на <code>bot</code>.</li>
                    <li>BotFather пришлёт токен вида <code>123456789:AAF…</code> — скопируйте его.</li>
                  </ol>
                }
                @case ('VK') {
                  <ol class="tb-wizard__howto">
                    <li>Создайте сообщество ВКонтакте (можно закрытое). «Управление» → «Сообщения»: включите.</li>
                    <li>«Работа с API» → «Ключи доступа»: создайте ключ с правом «Сообщения сообщества» и скопируйте его.</li>
                    <li>
                      «Работа с API» → «Long Poll API»: включите, версия API 5.199; в «Типах событий» отметьте «Входящее
                      сообщение».
                    </li>
                    <li>Номер сообщества — цифры из адреса вида <code>club123456</code>.</li>
                  </ol>
                }
                @case ('MAX') {
                  <ol class="tb-wizard__howto">
                    <li>
                      Создайте бота на платформе MAX для партнёров
                      (<a href="https://dev.max.ru" target="_blank" rel="noopener">dev.max.ru</a>).
                    </li>
                    <li>Скопируйте токен бота.</li>
                  </ol>
                }
              }
              <div class="tb-actions">
                <p-button label="Бот создан, дальше" icon="pi pi-arrow-right" iconPos="right" (onClick)="go(2)" />
              </div>
            </div>
          }
        </li>

        <li class="tb-wizard__step" [class.tb-wizard__step--active]="step() === 2" [class.tb-wizard__step--done]="step() > 2">
          <button type="button" class="tb-wizard__header" (click)="go(2)">
            <span class="tb-wizard__number">2</span>
            <span>Вставьте токен</span>
          </button>
          @if (step() === 2 && bot()?.fromEnvironment === true) {
            <div class="tb-wizard__body">
              <p class="tb-muted">
                Этот бот задан в переменных окружения сервера (TEACHERBOX_NOTIFICATIONS_*), токен меняется там.
              </p>
            </div>
          } @else if (step() === 2) {
            <form class="tb-wizard__body tb-form" [formGroup]="form" (ngSubmit)="saveToken()">
              @if (bot(); as current) {
                @if (current.configured) {
                  <p class="tb-muted">
                    Бот {{ current.botName ?? '' }} уже подключён. Чтобы заменить его, вставьте токен другого бота.
                  </p>
                }
              }
              <div class="tb-field">
                <label for="bot-token">{{ channel() === 'VK' ? 'Ключ доступа сообщества' : 'Токен бота' }}</label>
                <p-password
                  inputId="bot-token"
                  formControlName="token"
                  [feedback]="false"
                  [toggleMask]="true"
                  [fluid]="true"
                  autocomplete="off"
                />
              </div>
              @if (channel() === 'VK') {
                <div class="tb-field">
                  <label for="bot-group">Номер сообщества</label>
                  <p-inputnumber inputId="bot-group" formControlName="groupId" [useGrouping]="false" [min]="1" [fluid]="true" />
                </div>
              }
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              <div class="tb-actions">
                <p-button
                  type="submit"
                  label="Проверить и сохранить"
                  icon="pi pi-check"
                  [loading]="pending()"
                  [disabled]="form.invalid"
                />
              </div>
            </form>
          }
        </li>

        <li class="tb-wizard__step" [class.tb-wizard__step--active]="step() === 3" [class.tb-wizard__step--done]="step() > 3">
          <button type="button" class="tb-wizard__header" [disabled]="!configured()" (click)="go(3)">
            <span class="tb-wizard__number">3</span>
            <span>Подключите свой аккаунт</span>
          </button>
          @if (step() === 3) {
            <div class="tb-wizard__body">
              @if (bot()?.botName; as botName) {
                <p-message severity="success" styleClass="tb-form-message">Бот {{ botName }} работает.</p-message>
              }
              @if (teacherLinked()) {
                <p>Ваш аккаунт {{ name() }} уже подключён — уведомления будут приходить и вам.</p>
                <div class="tb-actions">
                  <p-button label="Дальше" icon="pi pi-arrow-right" iconPos="right" (onClick)="go(4)" />
                </div>
              } @else if (linkCode(); as code) {
                <tb-link-code-view [code]="code" />
              } @else {
                <p>Чтобы уведомления приходили и вам, подключите свой аккаунт к боту.</p>
                <div class="tb-actions">
                  <p-button label="Подключить мой аккаунт" icon="pi pi-link" [loading]="pending()" (onClick)="connect()" />
                  <p-button label="Пропустить" severity="secondary" [text]="true" (onClick)="close()" />
                </div>
              }
            </div>
          }
        </li>

        <li class="tb-wizard__step" [class.tb-wizard__step--active]="step() === 4">
          <button type="button" class="tb-wizard__header" [disabled]="!teacherLinked()" (click)="go(4)">
            <span class="tb-wizard__number">4</span>
            <span>Проверьте связь</span>
          </button>
          @if (step() === 4) {
            <div class="tb-wizard__body">
              @if (tested()) {
                <p-message severity="success" styleClass="tb-form-message">
                  Тестовое сообщение отправлено. Если оно пришло в {{ name() }} — всё готово.
                </p-message>
              } @else {
                <p>Отправим вам тестовое сообщение через бота.</p>
              }
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              <div class="tb-actions">
                <p-button
                  label="Отправить тестовое сообщение"
                  icon="pi pi-send"
                  [outlined]="tested()"
                  [loading]="pending()"
                  (onClick)="sendTest()"
                />
                @if (tested()) {
                  <p-button label="Готово" icon="pi pi-check" (onClick)="close()" />
                }
              </div>
            </div>
          }
        </li>
      </ol>
    </p-dialog>
  `,
  styles: `
    .tb-wizard {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-wizard__header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.25rem 0;
      border: 0;
      background: none;
      color: var(--p-text-muted-color);
      font: inherit;
      text-align: left;
      cursor: pointer;

      &:disabled {
        cursor: default;
        opacity: 0.6;
      }
    }

    .tb-wizard__number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 50%;
    }

    .tb-wizard__step--active .tb-wizard__header {
      color: var(--p-text-color);
      font-weight: 600;

      .tb-wizard__number {
        border-color: var(--p-primary-color);
        background: var(--p-primary-color);
        color: var(--p-primary-contrast-color);
      }
    }

    .tb-wizard__step--done .tb-wizard__number {
      border-color: var(--p-primary-color);
      color: var(--p-primary-color);
    }

    .tb-wizard__body {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin: 0.25rem 0 0.75rem 1rem;
      padding-left: 1.75rem;
      border-left: 1px solid var(--p-content-border-color);

      p {
        margin: 0;
      }
    }

    .tb-wizard__howto {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding-left: 1.25rem;
    }
  `,
})
export class BotWizardDialog {
  private readonly api = inject(NotificationsApi);
  private watch: Subscription | null = null;

  readonly visible = model(false);
  readonly channel = input<ChannelType>('TELEGRAM');
  /** The bot as it is now; the wizard starts from the first step that is not done yet. */
  readonly setup = input<ChannelSetup | null>(null);
  /** The bot or the teacher's account changed. */
  readonly changed = output<ChannelSetup>();

  protected readonly name = computed(() => CHANNEL_NAMES[this.channel()]);
  protected readonly step = signal<WizardStep>(1);
  protected readonly bot = signal<ChannelSetup | null>(null);
  protected readonly configured = computed(() => this.bot()?.configured ?? false);
  protected readonly teacherLinked = computed(() => this.bot()?.teacherLinked ?? false);
  protected readonly linkCode = signal<LinkCode | null>(null);
  protected readonly pending = signal(false);
  protected readonly tested = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    token: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    groupId: new FormControl<number | null>(null),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        untracked(() => {
          this.start();
        });
      } else {
        untracked(() => {
          this.stopWatching();
        });
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.stopWatching();
    });
  }

  go(step: WizardStep): void {
    if ((step === 3 && !this.configured()) || (step === 4 && !this.teacherLinked())) {
      return;
    }
    this.error.set(null);
    this.step.set(step);
  }

  saveToken(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.api
      .saveBot(this.channel(), { token: value.token.trim(), groupId: this.channel() === 'VK' ? value.groupId : null })
      .subscribe({
        next: (saved) => {
          this.pending.set(false);
          this.form.reset();
          this.update(saved);
          this.step.set(saved.teacherLinked ? 4 : 3);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeMessengerError(error, 'Не удалось проверить токен'));
        },
      });
  }

  connect(): void {
    this.pending.set(true);
    this.api.createLinkCode(this.channel()).subscribe({
      next: (code) => {
        this.pending.set(false);
        this.linkCode.set(code);
        this.watchLinking();
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  sendTest(): void {
    if (this.pending()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api.testBot(this.channel()).subscribe({
      next: () => {
        this.pending.set(false);
        this.tested.set(true);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeMessengerError(error, 'Не удалось отправить тестовое сообщение'));
      },
    });
  }

  close(): void {
    this.visible.set(false);
  }

  private start(): void {
    const setup = this.setup();
    this.bot.set(setup);
    this.linkCode.set(null);
    this.tested.set(false);
    this.error.set(null);
    this.pending.set(false);
    this.form.reset({ token: '', groupId: setup?.groupId ?? null });
    this.form.controls.groupId.setValidators(this.channel() === 'VK' ? [Validators.required, Validators.min(1)] : []);
    this.form.controls.groupId.updateValueAndValidity();
    if (setup?.configured !== true) {
      this.step.set(1);
    } else {
      this.step.set(setup.teacherLinked ? 4 : 3);
    }
  }

  /** Waits until the bot reports that the teacher's account is connected. */
  private watchLinking(): void {
    this.stopWatching();
    const channel = this.channel();
    this.watch = interval(LINK_POLL_INTERVAL_MS)
      .pipe(switchMap(() => this.api.bots()))
      .subscribe((bots) => {
        const current = bots.find((bot) => bot.channel === channel);
        if (current?.teacherLinked === true) {
          this.stopWatching();
          this.linkCode.set(null);
          this.update(current);
          this.step.set(4);
        }
      });
  }

  private stopWatching(): void {
    this.watch?.unsubscribe();
    this.watch = null;
  }

  private update(setup: ChannelSetup): void {
    this.bot.set(setup);
    this.changed.emit(setup);
  }
}
