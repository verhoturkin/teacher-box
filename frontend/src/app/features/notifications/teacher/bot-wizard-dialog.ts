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
import { InputNumber } from 'primeng/inputnumber';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { Subscription, interval, switchMap } from 'rxjs';
import { HelpButton } from '@features/help/parts';
import { describeError } from '@core/http/error-messages';
import { isProblemDetail, problemCode } from '@core/http/problem-detail';
import { LINK_POLL_INTERVAL_MS } from '../account/notifications-section';
import { LinkCodeView } from '../channels/link-code-view';
import { NotificationsApi } from '../data-access/notifications-api';
import { ChannelSetup, ChannelType, LinkCode } from '../data-access/notifications.models';
import { CHANNEL_NAMES } from '../notification-labels';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { openedOnce } from '@shared/ui/dialog/opened-once';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { Step, Steps } from '@shared/ui/steps';

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
    TbDialog,
    InputNumber,
    LinkCodeView,
    Message,
    Password,
    PasswordToggle,
    FieldErrors,
    Steps,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (built()) {
      <tb-dialog
        kind="form"
        width="wide"
        [(visible)]="visible"
        [headline]="t.title(name())"
        [cancelLabel]="c.close"
      >
        <tb-help-button topic="teacher/notifications" [label]="t.more" />
        <tb-steps
          [steps]="steps()"
          [current]="step()"
          [label]="t.steps"
          [selectable]="true"
          (selected)="go($event)"
        >
          <ng-template>
            @switch (step()) {
              @case (1) {
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
                          }}<a href="https://dev.max.ru" target="_blank" rel="noopener"
                            >dev.max.ru</a
                          >).
                        </li>
                        <li>{{ t.maxCopy }}</li>
                      </ol>
                    }
                  }
                  <div class="tb-actions">
                    <p-button
                      [label]="t.created"
                      icon="tb-i tb-i-arrow_forward"
                      iconPos="right"
                      (onClick)="go(2)"
                    />
                  </div>
                </div>
              }
              @case (2) {
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
                    <p-message severity="error" styleClass="tb-form-message">{{
                      message
                    }}</p-message>
                  }
                  <div class="tb-actions">
                    <p-button
                      type="submit"
                      [label]="t.checkAndSave"
                      icon="tb-i tb-i-check"
                      [loading]="pending()"
                    />
                  </div>
                </form>
              }
              @case (3) {
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
                        icon="tb-i tb-i-arrow_forward"
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
                        icon="tb-i tb-i-link"
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
              @case (4) {
                <div class="tb-wizard__body">
                  @if (tested()) {
                    <p-message severity="success" styleClass="tb-form-message">{{
                      t.testSent(name())
                    }}</p-message>
                  } @else {
                    <p>{{ t.testHint }}</p>
                  }
                  @if (error(); as message) {
                    <p-message severity="error" styleClass="tb-form-message">{{
                      message
                    }}</p-message>
                  }
                  <div class="tb-actions">
                    <p-button
                      [label]="t.sendTest"
                      icon="tb-i tb-i-send"
                      severity="secondary"
                      [loading]="pending()"
                      (onClick)="sendTest()"
                    />
                    @if (tested()) {
                      <p-button [label]="t.done" icon="tb-i tb-i-check" (onClick)="close()" />
                    }
                  </div>
                </div>
              }
            }
          </ng-template>
        </tb-steps>
      </tb-dialog>
    }
  `,
  styles: `
    .tb-wizard__body {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);

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
  protected readonly c = SHARED_T.common;
  protected readonly t = T.wizard;
  private readonly api = inject(NotificationsApi);
  private watch: Subscription | null = null;

  readonly visible = model(false);
  /** Built when first opened (`openedOnce`): hidden, its form is not built with the page. */
  protected readonly built = openedOnce(this.visible);
  readonly channel = input<ChannelType>('TELEGRAM');
  /** The bot as it is now; the wizard starts from the first step that is not done yet. */
  readonly setup = input<ChannelSetup | null>(null);
  /** The bot or the teacher's account changed. */
  readonly changed = output<ChannelSetup>();

  protected readonly name = computed(() => CHANNEL_NAMES[this.channel()]);
  protected readonly step = signal<WizardStep>(1);
  protected readonly steps = computed<readonly Step<WizardStep>[]>(() => [
    { id: 1, title: this.t.step1 },
    { id: 2, title: this.t.step2 },
    { id: 3, title: this.t.step3, disabled: !this.configured() },
    { id: 4, title: this.t.step4, disabled: !this.teacherLinked() },
  ]);
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
