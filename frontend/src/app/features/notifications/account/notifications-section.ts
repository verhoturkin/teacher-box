import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { Subscription, interval, switchMap } from 'rxjs';
import { describeError } from '@core/http/error-messages';
import { injectMobile, injectWindowSize } from '@core/layout/mobile';
import { WebPush } from '@core/push/web-push';
import type { PushDevice } from '@core/push/web-push';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { SHARED_T } from '@shared/i18n/texts';
import { NotificationsApi } from '../data-access/notifications-api';
import {
  BotAbilities,
  ChannelState,
  ChannelType,
  LinkCode,
  NotificationPreferences,
  NotificationTopic,
} from '../data-access/notifications.models';
import { CHANNEL_ICONS, CHANNEL_NAMES, MUTABLE_TOPICS } from '../notification-labels';
import { LinkCodeView } from '../channels/link-code-view';
import { deviceName } from '../push/device-name';
import { T } from '../i18n/texts';

/** How often the channel list is reloaded while the user is connecting a messenger. */
export const LINK_POLL_INTERVAL_MS = 3_000;

/** Every half hour of the day: `00:00`, `00:30` … `23:30`. */
export const QUIET_TIMES: readonly string[] = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, '0');
  return `${hours}:${index % 2 === 0 ? '00' : '30'}`;
});

const DEFAULT_QUIET_FROM = '22:00';
const DEFAULT_QUIET_TO = '08:00';

/** `HH:mm` of a backend time (`HH:mm` or `HH:mm:ss`). */
function shortTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * «Уведомления» of «Мой аккаунт»: «Куда присылать» — the user's messengers and push devices in one
 * list, «Подключить» per row; «Что присылать» — topics and quiet hours; the teacher also allows
 * actions in the bot. Everything saves on change. A student with no messenger connected gets an
 * alert that leads the account. The host lays its parts into the grid of the account panel.
 */
@Component({
  selector: 'tb-notifications-section',
  imports: [
    DatePipe,
    FormsModule,
    Button,
    Card,
    LinkCodeView,
    Menu,
    Message,
    NgTemplateOutlet,
    Select,
    TbDialog,
    ToggleSwitch,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (connectFirst(); as first) {
      <div class="tb-connect-alert">
        <p-message severity="info" icon="tb-i tb-i-send">
          <div class="tb-connect-alert__body">
            <span class="tb-connect-alert__text">
              <strong>{{ t.alertTitle }}</strong> {{ t.alertText }}
            </span>
            <p-button [label]="t.connectTo(names[first])" (onClick)="connect(first)" />
          </div>
        </p-message>
      </div>
    }
    @if (mobile()) {
      <div class="tb-notify tb-notify--flat"><ng-container *ngTemplateOutlet="body" /></div>
    } @else {
      <p-card [header]="t.title" styleClass="tb-notify tb-section-card tb-section-card--flow">
        <ng-container *ngTemplateOutlet="body" />
      </p-card>
    }

    <ng-template #body>
      @if (!mobile()) {
        <p class="tb-muted">{{ t.about }}</p>
      }

      <h3 class="tb-section-label">{{ t.where }}</h3>
      <ul class="tb-list">
        @for (channel of channels() ?? []; track channel.channel) {
          @if (!medium() || channel.linked || teacher()) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i [class]="icons[channel.channel]"></i
              ></span>
              <div class="tb-list__text">
                <label
                  class="tb-list__title"
                  [attr.for]="channel.linked ? 'notify-channel-' + channel.channel : null"
                  >{{ names[channel.channel] }}</label
                >
                @if (channel.linked) {
                  <span class="tb-list__supporting">
                    {{ channel.displayName ?? tc.linked }},
                    {{ tc.since((channel.linkedAt | date: 'dd.MM.yyyy') ?? '') }}
                    @if (!channel.enabled) {
                      · {{ tc.paused }}
                    }
                  </span>
                } @else {
                  <span class="tb-list__supporting">{{ tc.notLinked }}</span>
                }
              </div>
              <div class="tb-list__trail" [class.tb-list__trail--inline]="!channel.linked">
                @if (channel.linked) {
                  <p-button
                    icon="tb-i tb-i-link_off"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="tc.unlink(names[channel.channel])"
                    [ariaLabel]="tc.unlink(names[channel.channel])"
                    [loading]="busy.is('unlink-' + channel.channel)"
                    (onClick)="unlink(channel.channel)"
                  />
                  <p-toggleswitch
                    [inputId]="'notify-channel-' + channel.channel"
                    #enabled="ngModel"
                    [ngModel]="channel.enabled"
                    (ngModelChange)="setEnabled(channel.channel, $event, enabled)"
                  />
                } @else {
                  <p-button
                    [label]="tc.connect"
                    severity="secondary"
                    (onClick)="connect(channel.channel)"
                  />
                }
              </div>
            </li>
          }
        }
        @if (push.devices() !== null) {
          <li>
            <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-computer"></i></span>
            <div class="tb-list__text">
              <label
                class="tb-list__title"
                [attr.for]="thisDevice() === null ? null : 'notify-this-device'"
                >{{ t.thisDevice }}</label
              >
              <span class="tb-list__supporting">
                @if (thisDevice(); as device) {
                  {{ name(device) }}
                  @if (device.failing) {
                    · {{ tp.failing }}
                  }
                } @else {
                  {{ hereName }}
                }
              </span>
            </div>
            <div class="tb-list__trail">
              @if (thisDevice(); as device) {
                <p-toggleswitch
                  inputId="notify-this-device"
                  #here="ngModel"
                  [ngModel]="true"
                  (ngModelChange)="disable(device, here)"
                  [disabled]="busy.is('disable-' + device.id)"
                />
              } @else if (canEnable()) {
                <p-button
                  [label]="tc.connect"
                  severity="secondary"
                  [loading]="busy.is('enable')"
                  (onClick)="enable()"
                />
              }
            </div>
          </li>
          @for (device of otherDevices(); track device.id) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i class="tb-i tb-i-devices"></i
              ></span>
              <div class="tb-list__text">
                <label class="tb-list__title" [for]="'notify-device-' + device.id">{{
                  name(device)
                }}</label>
                <span class="tb-list__supporting">
                  {{ tp.since((device.createdAt | date: 'dd.MM.yyyy') ?? '') }}
                  @if (device.failing) {
                    · {{ tp.failing }}
                  }
                </span>
              </div>
              <div class="tb-list__trail">
                <p-toggleswitch
                  [inputId]="'notify-device-' + device.id"
                  #other="ngModel"
                  [ngModel]="true"
                  (ngModelChange)="disable(device, other)"
                  [disabled]="busy.is('disable-' + device.id)"
                />
              </div>
            </li>
          }
        }
      </ul>
      @if (medium() && unlinked().length > 0 && !teacher()) {
        <div>
          <p-button
            [label]="t.moreMessenger"
            icon="tb-i tb-i-add"
            [text]="true"
            (onClick)="messengers.toggle($event)"
          />
          <p-menu #messengers [model]="unlinkedItems()" [popup]="true" appendTo="body" />
        </div>
      }
      @if (!push.enabledHere()) {
        @if (push.needsHomeScreen) {
          <p-message severity="info" styleClass="tb-form-message">{{ tp.homeScreen }}</p-message>
        } @else if (!push.supported) {
          <p-message severity="secondary" styleClass="tb-form-message">{{
            tp.unsupported
          }}</p-message>
        } @else if (push.denied()) {
          <p-message severity="warn" styleClass="tb-form-message">{{ tp.denied }}</p-message>
        }
      }

      @if (preferences(); as saved) {
        <h3 class="tb-section-label">{{ t.what }}</h3>
        @if (medium()) {
          <!-- medium (sketch StudentTablet): the topics are filter chips, the pressed ones are sent -->
          <div class="tb-notify__chips" role="group" [attr.aria-label]="t.what">
            @for (topic of topics(); track topic.topic) {
              <button
                type="button"
                class="tb-notify__chip"
                [class.tb-notify__chip--on]="!saved.mutedTopics.includes(topic.topic)"
                [attr.aria-pressed]="!saved.mutedTopics.includes(topic.topic)"
                [title]="topic.hint"
                (click)="setTopic(topic.topic, saved.mutedTopics.includes(topic.topic))"
              >
                @if (!saved.mutedTopics.includes(topic.topic)) {
                  <i class="tb-i tb-i-check" aria-hidden="true"></i>
                }
                {{ topic.label }}
              </button>
            }
          </div>
          @if (!teacher()) {
            <p class="tb-muted tb-notify__always">{{ t.teacherAlways }}</p>
          }
        } @else {
          <ul class="tb-list">
            @for (topic of topics(); track topic.topic) {
              <li>
                <div class="tb-list__text">
                  <label class="tb-list__title" [for]="'notify-topic-' + topic.topic">{{
                    topic.label
                  }}</label>
                  @if (!mobile()) {
                    <span class="tb-list__supporting">{{ topic.hint }}</span>
                  }
                </div>
                <div class="tb-list__trail">
                  <p-toggleswitch
                    [inputId]="'notify-topic-' + topic.topic"
                    [ngModel]="!saved.mutedTopics.includes(topic.topic)"
                    (ngModelChange)="setTopic(topic.topic, $event)"
                  />
                </div>
              </li>
            }
            @if (!teacher()) {
              <li>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ tr.teacherMessages }}</span>
                  <span class="tb-list__supporting">{{ tr.always }}</span>
                </div>
                <div class="tb-list__trail">
                  <i class="tb-i tb-i-lock tb-muted" aria-hidden="true"></i>
                </div>
              </li>
            }
          </ul>
        }

        @if (mobile()) {
          <!-- compact (sketch StudentPhone): «Тихие часы» is a row that opens its own screen -->
          <ul class="tb-list">
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i class="tb-i tb-i-bedtime"></i
              ></span>
              <div class="tb-list__text">
                <button
                  type="button"
                  class="tb-list__title tb-notify__row"
                  (click)="quietScreen.set(true)"
                >
                  {{ t.quiet }}
                </button>
                <span class="tb-list__supporting">{{ quietSummary(saved) }}</span>
              </div>
              <div class="tb-list__trail" aria-hidden="true">
                <i class="tb-i tb-i-chevron_right tb-muted"></i>
              </div>
            </li>
          </ul>
        } @else {
          <ng-container *ngTemplateOutlet="quietBlock" />
        }
        <ng-template #quietBlock>
          <ul class="tb-list">
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i class="tb-i tb-i-bedtime"></i
              ></span>
              <div class="tb-list__text">
                <label class="tb-list__title" for="notify-quiet">{{ t.quiet }}</label>
                <span class="tb-list__supporting">{{
                  saved.quietFrom === null
                    ? t.quietOff
                    : t.quietOn(short(saved.quietFrom), short(saved.quietTo ?? ''))
                }}</span>
              </div>
              <div class="tb-list__trail">
                <p-toggleswitch
                  inputId="notify-quiet"
                  [ngModel]="saved.quietFrom !== null"
                  (ngModelChange)="setQuiet($event)"
                />
              </div>
            </li>
          </ul>
          @if (saved.quietFrom !== null) {
            <div class="tb-notify__times">
              <div class="tb-field">
                <label for="quiet-from">{{ tr.from }}</label>
                <p-select
                  inputId="quiet-from"
                  [options]="times"
                  appendTo="body"
                  [ngModel]="short(saved.quietFrom)"
                  (onChange)="setQuietTime('quietFrom', $event.value)"
                />
              </div>
              <div class="tb-field">
                <label for="quiet-to">{{ tr.to }}</label>
                <p-select
                  inputId="quiet-to"
                  [options]="times"
                  appendTo="body"
                  [ngModel]="short(saved.quietTo ?? '')"
                  (onChange)="setQuietTime('quietTo', $event.value)"
                />
              </div>
              <small class="tb-hint tb-notify__times-hint">{{
                t.quietHint(short(saved.quietTo ?? ''))
              }}</small>
            </div>
          }
        </ng-template>
        <tb-dialog
          kind="form"
          [(visible)]="quietScreen"
          [headline]="t.quiet"
          [cancelLabel]="c.close"
        >
          <div class="tb-notify--flat"><ng-container *ngTemplateOutlet="quietBlock" /></div>
        </tb-dialog>
        @if (abilities(); as bot) {
          <ul class="tb-list">
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i class="tb-i tb-i-smart_toy"></i
              ></span>
              <div class="tb-list__text">
                <label class="tb-list__title" for="notify-teacher-actions">{{
                  t.teacherActions
                }}</label>
                <span class="tb-list__supporting">{{ t.teacherActionsHint }}</span>
              </div>
              <div class="tb-list__trail">
                <p-toggleswitch
                  inputId="notify-teacher-actions"
                  #actions="ngModel"
                  [ngModel]="bot.teacherActions"
                  (ngModelChange)="setTeacherActions($event, actions)"
                />
              </div>
            </li>
          </ul>
        }
      }
    </ng-template>

    <tb-dialog
      kind="sheet"
      [headline]="linkTitle()"
      [visible]="linkCode() !== null"
      (visibleChange)="onLinkVisibleChange($event)"
      [cancelLabel]="c.close"
    >
      @if (linkCode(); as code) {
        <tb-link-code-view [code]="code" />
      }
    </tb-dialog>
  `,
  styles: `
    /* the alert spans the account grid above every section; the card is one cell of it */
    :host {
      display: contents;
    }

    .tb-connect-alert {
      grid-column: 1 / -1;
      order: -1;
    }

    .tb-connect-alert__body {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2) var(--tb-space-4);
    }

    .tb-connect-alert__text {
      flex: 1 1 17.5rem;
    }

    /* the dialog renders into the body; its host takes no cell */
    tb-dialog {
      display: none;
    }

    /* the phone (sketch StudentPhone): the blocks stand in the list of the account, without a card */
    .tb-notify--flat {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);

      > * {
        margin: 0;
      }
    }

    /* «С» and «До» share the row (the sketches), the hint under both */
    .tb-notify__times {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--tb-space-1) var(--tb-space-3);
    }

    /* medium (sketch StudentTablet): the topics are M3 filter chips, many can be pressed */
    .tb-notify__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-notify__chip {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
      block-size: 2rem;
      box-sizing: border-box;
      padding: 0 var(--tb-space-4);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-sm);
      background: transparent;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
      cursor: pointer;

      > .tb-i {
        font-size: 1.125rem;
      }
    }

    .tb-notify__chip--on {
      padding-inline-start: var(--tb-space-2);
      border-color: transparent;
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-notify__always {
      margin: 0;
    }

    .tb-notify__row {
      border: 0;
      padding: 0;
      background: none;
      color: inherit;
      text-align: start;
      cursor: pointer;
    }

    .tb-notify__times-hint {
      grid-column: 1 / -1;
      margin-inline: var(--tb-space-4);
    }
  `,
})
export class NotificationsSection implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.section;
  protected readonly tc = T.channels;
  protected readonly tp = T.push;
  protected readonly tr = T.preferences;
  protected readonly busy = new Busy();
  protected readonly push = inject(WebPush);
  /** Compact: the blocks lie in the account's list without a card (sketch StudentPhone). */
  protected readonly mobile = injectMobile();
  private readonly size = injectWindowSize();
  protected readonly medium = computed(() => this.size() === 'medium');
  protected readonly quietScreen = signal(false);
  private readonly api = inject(NotificationsApi);
  private readonly snackbar = inject(Snackbar);
  private watch: Subscription | null = null;

  /** The teacher gets the teacher topics and «Действия учителя в боте»; a student gets the alert. */
  readonly teacher = input(false);

  protected readonly names = CHANNEL_NAMES;
  protected readonly icons = CHANNEL_ICONS;
  protected readonly times = [...QUIET_TIMES];
  protected readonly hereName = deviceName(navigator.userAgent, T.push.unknownDevice);
  protected readonly short = shortTime;

  protected readonly channels = signal<ChannelState[] | null>(null);
  protected readonly preferences = signal<NotificationPreferences | null>(null);
  protected readonly abilities = signal<BotAbilities | null>(null);
  protected readonly linkCode = signal<LinkCode | null>(null);

  protected readonly topics = computed(() =>
    MUTABLE_TOPICS.filter((topic) => (this.teacher() ? !topic.studentOnly : !topic.teacherOnly)),
  );
  /** A student with messengers to connect and none connected: the first one, for the alert. */
  protected readonly connectFirst = computed(() => {
    const channels = this.channels() ?? [];
    return this.teacher() || channels.some((channel) => channel.linked)
      ? null
      : (channels[0]?.channel ?? null);
  });
  protected readonly unlinked = computed(() =>
    (this.channels() ?? []).filter((channel) => !channel.linked),
  );
  protected readonly unlinkedItems = computed<MenuItem[]>(() =>
    this.unlinked().map((channel) => ({
      label: CHANNEL_NAMES[channel.channel],
      icon: CHANNEL_ICONS[channel.channel],
      command: () => {
        this.connect(channel.channel);
      },
    })),
  );
  protected readonly thisDevice = computed(
    () => this.push.devices()?.find((device) => this.push.isThisDevice(device)) ?? null,
  );
  protected readonly otherDevices = computed(() =>
    (this.push.devices() ?? []).filter((device) => !this.push.isThisDevice(device)),
  );
  protected readonly canEnable = computed(
    () => this.push.supported && !this.push.needsHomeScreen && !this.push.denied(),
  );
  protected readonly linkTitle = computed(() => {
    const code = this.linkCode();
    return code === null ? '' : T.channels.linkTitle(CHANNEL_NAMES[code.channel]);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopWatching();
    });
  }

  ngOnInit(): void {
    this.reloadChannels();
    this.push.load();
    this.api.preferences().subscribe((preferences) => {
      this.preferences.set(preferences);
    });
    if (this.teacher()) {
      this.api.botAbilities().subscribe((abilities) => {
        this.abilities.set(abilities);
      });
    }
  }

  protected quietSummary(saved: NotificationPreferences): string {
    return saved.quietFrom === null
      ? this.t.quietOff
      : this.t.quietOn(shortTime(saved.quietFrom), shortTime(saved.quietTo ?? ''));
  }

  protected name(device: PushDevice): string {
    return deviceName(device.userAgent, T.push.unknownDevice);
  }

  connect(channel: ChannelType): void {
    this.api.createLinkCode(channel).subscribe((code) => {
      this.linkCode.set(code);
      this.watchLinking(channel);
    });
  }

  onLinkVisibleChange(visible: boolean): void {
    if (!visible) {
      this.closeLink();
    }
  }

  closeLink(): void {
    this.stopWatching();
    this.linkCode.set(null);
  }

  /** A failure puts `toggle` back: the binding has not changed, so it would not. */
  setEnabled(channel: ChannelType, enabled: boolean, toggle?: NgModel): void {
    this.api.setChannelEnabled(channel, enabled).subscribe({
      next: (saved) => {
        this.channels.update((channels) =>
          (channels ?? []).map((state) => (state.channel === saved.channel ? saved : state)),
        );
      },
      error: () => {
        toggle?.control.setValue(!enabled, { emitViewToModelChange: false });
      },
    });
  }

  unlink(channel: ChannelType): void {
    this.busy.guard('unlink-' + channel, this.api.unlink(channel)).subscribe(() => {
      this.snackbar.info(T.channels.unlinked(CHANNEL_NAMES[channel]));
      this.reloadChannels();
    });
  }

  enable(): void {
    this.busy.guard('enable', this.push.enable()).subscribe({
      next: () => {
        this.snackbar.success(T.push.enabled);
      },
      error: () => {
        this.snackbar.error(this.push.denied() ? T.push.denied : T.push.failed);
      },
    });
  }

  disable(device: PushDevice, toggle?: NgModel): void {
    this.busy.guard('disable-' + device.id, this.push.disable(device)).subscribe({
      next: () => {
        this.snackbar.info(T.push.disabled);
      },
      error: () => {
        // the device is still there
        toggle?.control.setValue(true, { emitViewToModelChange: false });
      },
    });
  }

  setTopic(topic: NotificationTopic, send: boolean): void {
    this.save((saved) => ({
      ...saved,
      mutedTopics: send
        ? saved.mutedTopics.filter((muted) => muted !== topic)
        : [...saved.mutedTopics, topic],
    }));
  }

  setQuiet(quiet: boolean): void {
    this.save((saved) => ({
      ...saved,
      quietFrom: quiet ? DEFAULT_QUIET_FROM : null,
      quietTo: quiet ? DEFAULT_QUIET_TO : null,
    }));
  }

  setQuietTime(edge: 'quietFrom' | 'quietTo', time: string): void {
    this.save((saved) => ({ ...saved, [edge]: time }));
  }

  setTeacherActions(enabled: boolean, toggle?: NgModel): void {
    this.api.setTeacherActions(enabled).subscribe({
      next: (abilities) => {
        this.abilities.set(abilities);
        this.snackbar.success(T.preferences.saved);
      },
      error: () => {
        toggle?.control.setValue(!enabled, { emitViewToModelChange: false });
      },
    });
  }

  /** Saves at once; a failure puts the switches back to the saved state. */
  private save(change: (saved: NotificationPreferences) => NotificationPreferences): void {
    const saved = this.preferences();
    if (saved === null) {
      return;
    }
    const next = change(saved);
    this.preferences.set(next);
    this.api.savePreferences(next).subscribe({
      next: (stored) => {
        this.preferences.set(stored);
        this.snackbar.success(T.preferences.saved);
      },
      error: (error: unknown) => {
        this.preferences.set({ ...saved });
        this.snackbar.error(describeError(error, T.preferences.failed));
      },
    });
  }

  private reloadChannels(): void {
    this.api.channels().subscribe((channels) => {
      this.channels.set(channels);
    });
  }

  /** Reloads the channels until the bot reports that the account is connected. */
  private watchLinking(channel: ChannelType): void {
    this.stopWatching();
    this.watch = interval(LINK_POLL_INTERVAL_MS)
      .pipe(switchMap(() => this.api.channels()))
      .subscribe((channels) => {
        this.channels.set(channels);
        if (channels.some((state) => state.channel === channel && state.linked)) {
          this.closeLink();
          this.snackbar.success(T.channels.connected(CHANNEL_NAMES[channel]));
        }
      });
  }

  private stopWatching(): void {
    this.watch?.unsubscribe();
    this.watch = null;
  }
}
