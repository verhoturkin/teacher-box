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
import { HelpButton } from '@features/help/parts';
import { describeError } from '@core/http/error-messages';
import { isProblemDetail, problemCode } from '@core/http/problem-detail';
import { LINK_POLL_INTERVAL_MS } from '../channels/channels-panel';
import { LinkCodeView } from '../channels/link-code-view';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelSetup, ChannelType, LinkCode } from '../data-access/notifications.models';
import { CHANNEL_NAMES } from '../notification-labels';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { T } from '../i18n/texts';

/** Wizard steps: create a bot, check its token, connect the teacher's account, send a test message. */
export type WizardStep = 1 | 2 | 3 | 4;

/** Errors whose detail is the messenger's own answer, worth showing to the teacher. */
const MESSENGER_ERRORS = new Set([
  'notifications.channel-check-failed',
  'notifications.test-failed',
]);

function describeMessengerError(error: unknown, fallback: string): string {
  const message = describeError(error, fallback);
  const code = problemCode(error);
  if (code !== null && MESSENGER_ERRORS.has(code) && error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (isProblemDetail(body) && body.detail !== undefined && body.detail !== '') {
      return T.wizard.messengerAnswer(message, body.detail);
    }
  }
  return message;
}

/** Teacher: connects a messenger bot step by step, without editing the server configuration. */
@Component({
  selector: 'tb-bot-wizard-dialog',
  imports: [
    HelpButton,
    ReactiveFormsModule,
    Button,
    Dialog,
    InputNumber,
    LinkCodeView,
    Message,
    Password,
    PasswordToggle,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="t.title(name())"
      [(visible)]="visible"
      [modal]="true"
      appendTo="body"
      styleClass="tb-dialog tb-dialog--wide"
      [draggable]="false"
    >
      <tb-help-button topic="teacher/notifications" [label]="t.more" />
      <ol class="tb-wizard">
        <li
          class="tb-wizard__step"
          [class.tb-wizard__step--active]="step() === 1"
          [class.tb-wizard__step--done]="step() > 1"
        >
          <button type="button" class="tb-wizard__header" (click)="go(1)">
            <span class="tb-wizard__number">1</span>
            <span>{{ t.step1 }}</span>
          </button>
          @if (step() === 1) {
            <div class="tb-wizard__body">
              @switch (channel()) {
                @case ('TELEGRAM') {
                  <ol class="tb-wizard__howto">
                    <li>
                      {{ t.tgOpen }}
                      <a href="https://t.me/BotFather" target="_blank" rel="noopener"
                        >&#64;BotFather</a
                      >
                      {{ t.tgSend }} <code>/newbot</code>.
                    </li>
                    <li>
                      {{ t.tgName }}
                      <code>bot</code>.
                    </li>
                    <li>{{ t.tgToken }} <code>123456789:AAF…</code> {{ t.tgCopy }}</li>
                  </ol>
                }
                @case ('VK') {
                  <ol class="tb-wizard__howto">
                    <li>{{ t.vkCommunity }}</li>
                    <li>{{ t.vkKey }}</li>
                    <li>{{ t.vkLongPoll }}</li>
                    <li>{{ t.vkButtons }}</li>
                    <li>{{ t.vkNumber }} <code>club123456</code>.</li>
                  </ol>
                }
                @case ('MAX') {
                  <ol class="tb-wizard__howto">
                    <li>
                      {{ t.maxCreate
                      }}<a href="https://dev.max.ru" target="_blank" rel="noopener">dev.max.ru</a>).
                    </li>
                    <li>{{ t.maxCopy }}</li>
                  </ol>
                }
              }
              <div class="tb-actions">
                <p-button
                  [label]="t.created"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  (onClick)="go(2)"
                />
              </div>
            </div>
          }
        </li>

        <li
          class="tb-wizard__step"
          [class.tb-wizard__step--active]="step() === 2"
          [class.tb-wizard__step--done]="step() > 2"
        >
          <button type="button" class="tb-wizard__header" (click)="go(2)">
            <span class="tb-wizard__number">2</span>
            <span>{{ t.step2 }}</span>
          </button>
          @if (step() === 2 && bot()?.fromEnvironment === true) {
            <div class="tb-wizard__body">
              <p class="tb-muted">{{ t.fromEnvironment }}</p>
            </div>
          } @else if (step() === 2) {
            <form
              tbFieldErrors
              class="tb-wizard__body tb-form"
              [formGroup]="form"
              (ngSubmit)="saveToken()"
            >
              @if (bot(); as current) {
                @if (current.configured) {
                  <p class="tb-muted">{{ t.replace(current.botName ?? '') }}</p>
                }
              }
              <div class="tb-field">
                <label for="bot-token">{{
                  channel() === 'VK' ? t.vkKeyLabel : t.tokenLabel
                }}</label>
                <p-password
                  inputId="bot-token"
                  formControlName="token"
                  [feedback]="false"
                  [toggleMask]="true"
                  [fluid]="true"
                  autocomplete="off"
                >
                  <ng-template #showicon><tb-password-toggle /></ng-template>
                  <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
                </p-password>
              </div>
              @if (channel() === 'VK') {
                <div class="tb-field">
                  <label for="bot-group">{{ t.community }}</label>
                  <p-inputnumber
                    inputId="bot-group"
                    formControlName="groupId"
                    [useGrouping]="false"
                    [min]="1"
                    [fluid]="true"
                  />
                </div>
              }
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              <div class="tb-actions">
                <p-button
                  severity="success"
                  type="submit"
                  [label]="t.checkAndSave"
                  icon="pi pi-check"
                  [loading]="pending()"
                />
              </div>
            </form>
          }
        </li>

        <li
          class="tb-wizard__step"
          [class.tb-wizard__step--active]="step() === 3"
          [class.tb-wizard__step--done]="step() > 3"
        >
          <button
            type="button"
            class="tb-wizard__header"
            [disabled]="!configured()"
            (click)="go(3)"
          >
            <span class="tb-wizard__number">3</span>
            <span>{{ t.step3 }}</span>
          </button>
          @if (step() === 3) {
            <div class="tb-wizard__body">
              @if (bot()?.botName; as botName) {
                <p-message severity="success" styleClass="tb-form-message">{{
                  t.works(botName)
                }}</p-message>
              }
              @if (teacherLinked()) {
                <p>{{ t.linked(name()) }}</p>
                <div class="tb-actions">
                  <p-button
                    [label]="t.next"
                    icon="pi pi-arrow-right"
                    iconPos="right"
                    (onClick)="go(4)"
                  />
                </div>
              } @else if (linkCode(); as code) {
                <tb-link-code-view [code]="code" />
              } @else {
                <p>{{ t.linkHint }}</p>
                <div class="tb-actions">
                  <p-button
                    [label]="t.connectMine"
                    icon="pi pi-link"
                    [loading]="pending()"
                    (onClick)="connect()"
                  />
                  <p-button
                    [label]="t.skip"
                    severity="secondary"
                    [text]="true"
                    (onClick)="close()"
                  />
                </div>
              }
            </div>
          }
        </li>

        <li class="tb-wizard__step" [class.tb-wizard__step--active]="step() === 4">
          <button
            type="button"
            class="tb-wizard__header"
            [disabled]="!teacherLinked()"
            (click)="go(4)"
          >
            <span class="tb-wizard__number">4</span>
            <span>{{ t.step4 }}</span>
          </button>
          @if (step() === 4) {
            <div class="tb-wizard__body">
              @if (tested()) {
                <p-message severity="success" styleClass="tb-form-message">{{
                  t.testSent(name())
                }}</p-message>
              } @else {
                <p>{{ t.testHint }}</p>
              }
              @if (error(); as message) {
                <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
              }
              <div class="tb-actions">
                <p-button
                  [label]="t.sendTest"
                  icon="pi pi-send"
                  class="tb-tonal"
                  severity="success"
                  [loading]="pending()"
                  (onClick)="sendTest()"
                />
                @if (tested()) {
                  <p-button [label]="t.done" icon="pi pi-check" (onClick)="close()" />
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
      gap: var(--tb-space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-wizard__header {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      width: 100%;
      padding: var(--tb-space-1) 0;
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
      border-radius: var(--tb-shape-full);
    }

    .tb-wizard__step--active .tb-wizard__header {
      color: var(--p-text-color);
      font-weight: 500;

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
      gap: var(--tb-space-3);
      margin: var(--tb-space-1) 0 var(--tb-space-3) var(--tb-space-4);
      padding-left: var(--tb-space-7);
      border-left: 1px solid var(--p-content-border-color);

      p {
        margin: 0;
      }
    }

    .tb-wizard__howto {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0;
      padding-left: var(--tb-space-5);
    }
  `,
})
export class BotWizardDialog {
  protected readonly t = T.wizard;
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
    token: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
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
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.api
      .saveBot(this.channel(), {
        token: value.token.trim(),
        groupId: this.channel() === 'VK' ? value.groupId : null,
      })
      .subscribe({
        next: (saved) => {
          this.pending.set(false);
          this.form.reset();
          this.update(saved);
          this.step.set(saved.teacherLinked ? 4 : 3);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeMessengerError(error, T.wizard.checkFailed));
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
        this.error.set(describeMessengerError(error, T.wizard.testFailed));
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
    this.form.controls.groupId.setValidators(
      this.channel() === 'VK' ? [Validators.required, Validators.min(1)] : [],
    );
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
