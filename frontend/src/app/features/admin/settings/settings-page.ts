import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { describeError } from '@core/http/error-messages';
import { problemCode, problemDetailText } from '@core/http/problem-detail';
import { Snackbar } from '@core/snackbar/snackbar';
import { HelpButton } from '@features/help/parts';
import { RESTART_POLL_MS, RESTART_WAIT_MS } from '@shared/restart/restart-wait';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { SHARED_T } from '@shared/i18n/texts';
import { AdminApi } from '../data-access/admin-api';
import {
  AdminSetting,
  AdminSettings,
  DailySchedule,
  SettingKind,
  SettingSource,
} from '../data-access/admin.models';
import { T } from '../i18n/texts';

type Stage = 'confirm' | 'restarting' | 'manual' | 'done' | 'silent';

/** The cards of the editable settings (sketch AdminLive), in the reading order. */
type CardKey = 'files' | 'network' | 'sessions' | 'messages' | 'other' | 'backups';

/** Which card a setting goes to; an editable setting not named here goes to «Другие настройки». */
const CARD_OF: Readonly<Record<string, CardKey>> = {
  TEACHERBOX_HOMEWORK_MAX_FILE_SIZE: 'files',
  TEACHERBOX_HOMEWORK_MAX_FILES_PER_UPLOAD: 'files',
  TEACHERBOX_HOMEWORK_YOUTUBE_PROXY: 'network',
  TEACHERBOX_SCHEDULE_GOOGLE_PROXY: 'network',
  TEACHERBOX_BACKUP_GOOGLE_PROXY: 'network',
  TEACHERBOX_NOTIFICATIONS_TELEGRAM_PROXY: 'network',
  TEACHERBOX_NOTIFICATIONS_TELEGRAM_API_URL: 'network',
  TEACHERBOX_AI_PROXY: 'network',
  TEACHERBOX_IDENTITY_ACCESS_TOKEN_TTL: 'sessions',
  TEACHERBOX_IDENTITY_REFRESH_TOKEN_TTL: 'sessions',
  TEACHERBOX_IDENTITY_INVITE_TTL: 'sessions',
  TEACHERBOX_IDENTITY_MAX_FAILED_LOGINS: 'sessions',
  TEACHERBOX_IDENTITY_LOCK_DURATION: 'sessions',
  TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_REQUESTS: 'sessions',
  TEACHERBOX_SECURITY_AUTH_RATE_LIMIT_PERIOD: 'sessions',
  TEACHERBOX_NOTIFICATIONS_MAX_ATTEMPTS: 'messages',
  TEACHERBOX_NOTIFICATIONS_LINK_CODE_TTL: 'messages',
  TEACHERBOX_NOTIFICATIONS_WEBPUSH_SUBJECT: 'messages',
  TEACHERBOX_BACKUP_CRON: 'backups',
  TEACHERBOX_BACKUP_KEEP_DAYS: 'backups',
  TEACHERBOX_BOARDS_BACKUP_CRON: 'backups',
  TEACHERBOX_BOARDS_BACKUP_KEEP: 'backups',
};

/** Three columns on expanded widths (sketch AdminLive); «Только в .env» ends the last one. */
const COLUMNS: readonly (readonly CardKey[])[] = [
  ['files', 'network'],
  ['sessions', 'messages', 'other'],
  ['backups'],
];

const CARD_ICONS: Readonly<Record<CardKey, string>> = {
  files: 'tb-i-attach_file',
  network: 'tb-i-lan',
  sessions: 'tb-i-login',
  messages: 'tb-i-chat',
  other: 'tb-i-tune',
  backups: 'tb-i-backup',
};

const CARD_HINTS: Readonly<Partial<Record<CardKey, string>>> = {
  network: T.settings.cards.networkHint,
  sessions: T.settings.cards.sessionsHint,
};

/** Kinds whose values are short: two fields share a row of a card. */
const SHORT_KINDS: ReadonlySet<SettingKind> = new Set<SettingKind>([
  'NUMBER',
  'DURATION',
  'DATA_SIZE',
  'BOOLEAN',
]);

/** The time a schedule switched on gets when it had none (the jobs' own defaults). */
const DEFAULT_TIMES: Readonly<Record<string, string>> = {
  TEACHERBOX_BACKUP_CRON: '03:30',
  TEACHERBOX_BOARDS_BACKUP_CRON: '03:00',
};
const DEFAULT_TIME = '03:00';
const OFF = '-';
const DAILY = /^0 (\d{1,2}) (\d{1,2}) \* \* \*$/;

const NAMED = Object.keys(CARD_OF);

/** The order inside a card: as `CARD_OF` names them (the portal's backup before the boards'), others last. */
function order(setting: AdminSetting): number {
  const index = NAMED.indexOf(setting.name);
  return index === -1 ? NAMED.length : index;
}

interface SettingsCard {
  readonly key: CardKey;
  readonly name: string;
  readonly icon: string;
  readonly hint: string | null;
  readonly settings: readonly AdminSetting[];
}

interface Option {
  readonly label: string;
  readonly value: string;
}

const SOURCE_LABELS: Readonly<Record<SettingSource, string>> = T.settings.sources;

const PLACEHOLDERS: Readonly<Partial<Record<SettingKind, string>>> = {
  DURATION: T.settings.placeholders.DURATION,
  DURATIONS: T.settings.placeholders.DURATIONS,
  DATA_SIZE: T.settings.placeholders.DATA_SIZE,
  CRON: T.settings.placeholders.CRON,
  ADDRESS: 'https://school.example.com',
  URL: 'https://…',
  PROXY: 'socks5://host:port',
  CURRENCY: 'RUB',
  NUMBER: T.settings.placeholders.NUMBER,
};

/** «вкл/выкл + время» of a cron the interface writes; `null` for any other cron. */
function dailySchedule(cron: string): DailySchedule | null {
  const value = cron.trim().replace(/\s+/g, ' ');
  if (value === OFF) {
    return { enabled: false, time: null };
  }
  const [, minute, hour] = DAILY.exec(value) ?? [];
  if (minute === undefined || hour === undefined || Number(minute) > 59 || Number(hour) > 23) {
    return null;
  }
  return { enabled: true, time: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` };
}

/** The cron of `HH:mm` every day. */
function dailyCron(time: string): string {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return `0 ${String(minutes)} ${String(hours)} * * *`;
}

/**
 * The administrator's settings of the portal (ADR-0016, ADR-0056; sketch AdminLive): the editable ones in cards
 * by purpose — «Файлы в заданиях», «Сеть и прокси», «Вход и сеансы», «Сообщения», «Резервные копии» (the backup
 * schedules as «вкл/выкл + время») — in three columns from expanded, one below; «Только в .env» lists what is
 * changed only there, with its current value; «Перенесено в настройки учителя» names the teacher's variables
 * still set. The edits are saved together with the password: live values are in force at once, a restart
 * follows only when a change needs one.
 */
@Component({
  selector: 'tb-admin-settings-page',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    Button,
    Card,
    DatePicker,
    Panes,
    Pane,
    TbDialog,
    HelpButton,
    InputText,
    Message,
    Select,
    Tag,
    ToggleSwitch,
    PageHeader,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <tb-page-header tbPaneHeader [title]="t.title">
          <tb-help-button help topic="admin/settings" />
          <span meta class="tb-admin-settings__live"
            ><i class="tb-i tb-i-bolt" aria-hidden="true"></i>{{ t.live }}</span
          >
          <p-button
            [label]="t.save"
            icon="tb-i tb-i-save"
            [disabled]="changes() === 0"
            (onClick)="openConfirm()"
          />
        </tb-page-header>
        <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
          <div class="tb-stack">
            @if (settings()?.moved; as moved) {
              @if (moved.length > 0) {
                <p-message severity="warn" icon="tb-i tb-i-info" styleClass="tb-form-message">
                  <div class="tb-admin-settings__moved">
                    <b>{{ t.moved.title }}</b>
                    <span>{{ t.moved.text }}</span>
                    <ul>
                      @for (setting of moved; track setting.name) {
                        <li>
                          <code>{{ setting.name }}</code> — {{ setting.group }}: {{ setting.title }}
                          @if (setting.source === 'ADMIN') {
                            ({{ t.moved.savedHere }})
                          }
                        </li>
                      }
                    </ul>
                  </div>
                </p-message>
              }
            }
            @if (settings()?.restartNeeded) {
              <p-message severity="warn" styleClass="tb-form-message">{{
                t.restartNeeded
              }}</p-message>
            }
            <div class="tb-admin-settings">
              @for (column of columns(); track $index; let last = $last) {
                <div class="tb-stack">
                  @for (card of column; track card.key) {
                    <p-card
                      styleClass="tb-section-card tb-section-card--flow"
                      [id]="'card-' + card.key"
                    >
                      <ng-template #title>
                        <h2 class="tb-admin-settings__title">
                          <i [class]="'tb-i ' + card.icon" aria-hidden="true"></i>{{ card.name }}
                        </h2>
                      </ng-template>
                      @if (card.hint; as hint) {
                        <p class="tb-hint">{{ hint }}</p>
                      }
                      <div class="tb-admin-settings__fields">
                        @for (setting of card.settings; track setting.name) {
                          @if (setting.kind === 'CRON' && scheduleOf(setting); as schedule) {
                            <label
                              class="tb-tile tb-admin-settings__wide tb-setting"
                              [for]="'setting-' + setting.name"
                            >
                              <span class="tb-tile__text">
                                <b>{{ scheduleTitle(setting) }}</b>
                                <span>{{ scheduleHint(setting) }}</span>
                              </span>
                              <p-toggleswitch
                                [inputId]="'setting-' + setting.name"
                                [ngModel]="schedule.enabled"
                                (ngModelChange)="toggle(setting, $event)"
                              />
                            </label>
                            @if (schedule.time; as time) {
                              <div class="tb-field">
                                <label [for]="'setting-' + setting.name + '-time'">{{
                                  t.time
                                }}</label>
                                <p-datepicker
                                  [inputId]="'setting-' + setting.name + '-time'"
                                  [ngModel]="timeDate(time)"
                                  (ngModelChange)="setTime(setting, $event)"
                                  [timeOnly]="true"
                                  hourFormat="24"
                                  [stepMinute]="5"
                                  appendTo="body"
                                  [fluid]="true"
                                />
                                @if (!setting.live) {
                                  <small class="tb-hint tb-admin-settings__support">
                                    <ng-container [ngTemplateOutlet]="restartNote" />
                                  </small>
                                }
                                <ng-container
                                  [ngTemplateOutlet]="meta"
                                  [ngTemplateOutletContext]="{ $implicit: setting }"
                                />
                              </div>
                            }
                          } @else {
                            <div
                              class="tb-field tb-setting"
                              [class.tb-admin-settings__wide]="!short(setting)"
                            >
                              <label [for]="'setting-' + setting.name">{{ label(setting) }}</label>
                              @if (setting.kind === 'CHOICE' || setting.kind === 'BOOLEAN') {
                                <p-select
                                  [inputId]="'setting-' + setting.name"
                                  [options]="options(setting)"
                                  optionLabel="label"
                                  optionValue="value"
                                  [ngModel]="current(setting)"
                                  (ngModelChange)="change(setting, $event)"
                                  appendTo="body"
                                />
                              } @else {
                                <input
                                  pInputText
                                  [id]="'setting-' + setting.name"
                                  [type]="setting.secret ? 'password' : 'text'"
                                  autocomplete="off"
                                  [value]="current(setting)"
                                  [placeholder]="placeholder(setting)"
                                  (input)="type(setting, $event)"
                                />
                              }
                              @if (
                                setting.kind === 'CRON' || setting.hint !== '' || !setting.live
                              ) {
                                <!-- one supporting block: the field puts all its supporting text in one place -->
                                <small class="tb-hint tb-admin-settings__support">
                                  @if (setting.kind === 'CRON') {
                                    <span>{{ t.customCron }}</span>
                                  } @else if (setting.hint !== '') {
                                    <span>{{ setting.hint }}</span>
                                  }
                                  @if (!setting.live) {
                                    <ng-container [ngTemplateOutlet]="restartNote" />
                                  }
                                </small>
                              }
                              <ng-container
                                [ngTemplateOutlet]="meta"
                                [ngTemplateOutletContext]="{ $implicit: setting }"
                              />
                            </div>
                          }
                        }
                      </div>
                    </p-card>
                  }
                  @if (last && fixed().length > 0) {
                    <p-card styleClass="tb-section-card tb-section-card--flow" id="card-env">
                      <ng-template #title>
                        <h2 class="tb-admin-settings__title">
                          <i class="tb-i tb-i-description" aria-hidden="true"></i
                          >{{ t.cards.envOnly }}
                        </h2>
                      </ng-template>
                      <p class="tb-hint">{{ t.cards.envOnlyHint }}</p>
                      <ul class="tb-list tb-list--no-lead">
                        @for (setting of fixed(); track setting.name) {
                          <li class="tb-setting">
                            <div class="tb-list__text">
                              <span class="tb-list__title">{{ setting.title }}</span>
                              <span class="tb-list__supporting" [id]="'setting-' + setting.name">
                                @if (setting.secret) {
                                  <p-tag
                                    [value]="setting.set ? t.secretSet : t.secretNotSet"
                                    severity="secondary"
                                  />
                                } @else {
                                  {{ shown(setting) }}
                                }
                              </span>
                              <code class="tb-setting__name">{{ setting.name }}</code>
                              @if (setting.source === 'ADMIN') {
                                <p-button
                                  class="tb-setting__revert"
                                  [label]="edited(setting) ? t.edited : t.removeSaved"
                                  severity="secondary"
                                  [text]="true"
                                  [disabled]="edited(setting)"
                                  [ariaLabel]="t.removeSavedOf(setting.title)"
                                  (onClick)="revert(setting)"
                                />
                              }
                            </div>
                          </li>
                        }
                      </ul>
                    </p-card>
                  }
                </div>
              }
            </div>
          </div>
        </tb-load-state>
      </tb-pane>
    </tb-panes>

    <ng-template #restartNote>
      <span class="tb-admin-settings__note"
        ><i class="tb-i tb-i-restart_alt" aria-hidden="true"></i>{{ t.afterRestart }}</span
      >
    </ng-template>

    <ng-template #meta let-setting>
      @if (setting.source !== 'DEFAULT' || edited(setting)) {
        <div class="tb-setting__meta">
          <p-tag
            [value]="sources[sourceOf(setting)]"
            [severity]="sourceOf(setting) === 'ADMIN' ? 'info' : 'secondary'"
          />
          @if (edited(setting)) {
            <p-tag [value]="t.edited" severity="warn" />
          }
          @if (setting.source === 'ADMIN' && !reverted(setting)) {
            <p-button
              class="tb-setting__revert"
              [label]="t.revert"
              severity="secondary"
              [text]="true"
              [ariaLabel]="t.revertOf(setting.title)"
              (onClick)="revert(setting)"
            />
          }
        </div>
      }
    </ng-template>

    <tb-dialog
      kind="alert"
      [(visible)]="confirmVisible"
      [headline]="t.confirmTitle"
      [closable]="stage() !== 'restarting'"
      [confirmLabel]="stage() === 'confirm' ? c.save : stage() === 'restarting' ? null : t.finish"
      [cancelLabel]="stage() === 'confirm' ? c.cancel : null"
      [formId]="stage() === 'confirm' ? 'settings-confirm' : undefined"
      [pending]="pending()"
      [error]="error()"
      (confirm)="confirmVisible.set(false)"
    >
      @switch (stage()) {
        @case ('confirm') {
          <form id="settings-confirm" class="tb-form" (ngSubmit)="save()">
            <p>{{ needsRestart() ? t.changes(changes()) : t.changesLive(changes()) }}</p>
            <div class="tb-field">
              <label for="settings-password">{{ t.password }}</label>
              <input
                pInputText
                id="settings-password"
                type="password"
                name="password"
                autocomplete="current-password"
                [(ngModel)]="password"
              />
            </div>
          </form>
        }
        @case ('restarting') {
          <p>{{ t.restarting }}</p>
        }
        @case ('manual') {
          <p>{{ t.manual }}</p>
        }
        @case ('done') {
          <p>{{ t.done }}</p>
        }
        @case ('silent') {
          <p>{{ t.silent }}</p>
        }
      }
    </tb-dialog>
  `,
  styles: `
    /* Sketch AdminLive: three columns of cards on expanded widths, one below 22 rem each (as «Занятия») */
    .tb-admin-settings {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
      gap: var(--tb-space-4);
      align-items: start;
    }

    .tb-admin-settings__title {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      margin: 0;
      font: inherit;

      .tb-i {
        color: var(--p-md-primary);
        font-size: 1.25rem;
      }
    }

    .tb-admin-settings__live {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
    }

    .tb-admin-settings__moved {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);

      ul {
        margin: 0;
        padding-inline-start: var(--tb-space-5);
      }
    }

    /* Two short fields share a row (sketch: «Размер одного файла» · «Файлов за раз»); the rest take it whole */
    .tb-admin-settings__fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
      gap: var(--tb-space-3);
      align-items: start;
    }

    .tb-admin-settings__wide {
      grid-column: 1 / -1;
    }

    .tb-admin-settings__support {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
    }

    .tb-admin-settings__note {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);

      .tb-i {
        font-size: 1rem;
      }
    }

    .tb-setting__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-setting__name {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
      font-family: var(--tb-font-mono);
      overflow-wrap: anywhere;
    }

    .tb-setting__revert {
      align-self: flex-start;
    }
  `,
})
export class SettingsPage implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.settings;
  private readonly api = inject(AdminApi);
  private readonly snackbar = inject(Snackbar);
  private readonly pollMs = inject(RESTART_POLL_MS);

  protected readonly sources = SOURCE_LABELS;
  protected readonly settings = signal<AdminSettings | null>(null);
  protected readonly state = new LoadState();
  /** Changed values by variable name; `null`: back to `.env`. */
  readonly edits = signal<Readonly<Record<string, string | null>>>({});
  protected readonly changes = computed(() => Object.keys(this.edits()).length);
  /** A change that is not live: the portal restarts after the save. */
  protected readonly needsRestart = computed(() => {
    const edits = this.edits();
    return (this.settings()?.settings ?? []).some(
      (setting) => setting.name in edits && !setting.live,
    );
  });

  /** What is changed only in `.env`: Docker, the accounts and the recovery settings. */
  protected readonly fixed = computed(() =>
    (this.settings()?.settings ?? []).filter((setting) => setting.access !== 'EDITABLE'),
  );
  protected readonly columns = computed<SettingsCard[][]>(() => {
    const byCard = new Map<CardKey, AdminSetting[]>();
    for (const setting of this.settings()?.settings ?? []) {
      if (setting.access === 'EDITABLE') {
        const key = CARD_OF[setting.name] ?? 'other';
        byCard.set(key, [...(byCard.get(key) ?? []), setting]);
      }
    }
    return COLUMNS.map((column) =>
      column.flatMap((key) => {
        const settings = [...(byCard.get(key) ?? [])].sort((a, b) => order(a) - order(b));
        return settings.length === 0
          ? []
          : [
              {
                key,
                name: T.settings.cards[key],
                icon: CARD_ICONS[key],
                hint: CARD_HINTS[key] ?? null,
                settings,
              },
            ];
      }),
    );
  });

  protected readonly confirmVisible = signal(false);
  protected readonly stage = signal<Stage>('confirm');
  protected readonly password = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly times = new Map<string, Date>();
  private startedAt: string | null = null;
  private deadline = 0;
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopPolling();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  protected current(setting: AdminSetting): string {
    const edits = this.edits();
    return setting.name in edits ? (edits[setting.name] ?? '') : (setting.value ?? '');
  }

  protected edited(setting: AdminSetting): boolean {
    return setting.name in this.edits();
  }

  protected reverted(setting: AdminSetting): boolean {
    const edits = this.edits();
    return setting.name in edits && edits[setting.name] === null;
  }

  /** Where the value on screen comes from: an edit is the administrator's. */
  protected sourceOf(setting: AdminSetting): SettingSource {
    if (!this.edited(setting)) {
      return setting.source;
    }
    return this.reverted(setting) ? 'ENVIRONMENT' : 'ADMIN';
  }

  /** Two short fields share a row only under a short label (sketch AdminLive): a long title gets the row. */
  protected short(setting: AdminSetting): boolean {
    return SHORT_KINDS.has(setting.kind) && setting.name in T.settings.labels;
  }

  protected label(setting: AdminSetting): string {
    return T.settings.labels[setting.name] ?? setting.title;
  }

  /**
   * The schedule on screen: the edited cron when it has that form, otherwise the one in force; `null` shows the
   * cron itself (a custom one, or back to `.env` before the save).
   */
  protected scheduleOf(setting: AdminSetting): DailySchedule | null {
    const edits = this.edits();
    if (!(setting.name in edits)) {
      return setting.schedule;
    }
    const value = edits[setting.name];
    return value === null || value === undefined ? null : dailySchedule(value);
  }

  protected scheduleTitle(setting: AdminSetting): string {
    return T.settings.schedules[setting.name]?.title ?? setting.title;
  }

  protected scheduleHint(setting: AdminSetting): string {
    return T.settings.schedules[setting.name]?.hint ?? setting.hint;
  }

  toggle(setting: AdminSetting, enabled: boolean): void {
    const time = setting.schedule?.time ?? DEFAULT_TIMES[setting.name] ?? DEFAULT_TIME;
    this.change(setting, enabled ? dailyCron(time) : OFF);
  }

  /** The picker's value: one `Date` per time, so the picker is not given a new value on every check. */
  protected timeDate(time: string): Date {
    let date = this.times.get(time);
    if (date === undefined) {
      const [hours = 0, minutes = 0] = time.split(':').map(Number);
      date = new Date();
      date.setHours(hours, minutes, 0, 0);
      this.times.set(time, date);
    }
    return date;
  }

  setTime(setting: AdminSetting, date: Date | null): void {
    if (date instanceof Date) {
      this.change(setting, dailyCron(`${String(date.getHours())}:${String(date.getMinutes())}`));
    }
  }

  protected shown(setting: AdminSetting): string {
    return setting.value === null || setting.value === '' ? T.settings.notSet : setting.value;
  }

  protected placeholder(setting: AdminSetting): string {
    if (setting.secret) {
      return setting.set ? T.settings.secretReplace : T.settings.secretNotSet;
    }
    return PLACEHOLDERS[setting.kind] ?? '';
  }

  protected options(setting: AdminSetting): Option[] {
    const values =
      setting.kind === 'BOOLEAN'
        ? [
            { label: T.settings.yes, value: 'true' },
            { label: T.settings.no, value: 'false' },
          ]
        : setting.choices.map((choice) => ({ label: choice, value: choice }));
    return [{ label: T.settings.notSet, value: '' }, ...values];
  }

  protected type(setting: AdminSetting, event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.change(setting, event.target.value);
    }
  }

  change(setting: AdminSetting, value: string): void {
    this.edits.update((edits) => ({ ...edits, [setting.name]: value }));
  }

  revert(setting: AdminSetting): void {
    this.edits.update((edits) => ({ ...edits, [setting.name]: null }));
  }

  openConfirm(): void {
    this.stage.set('confirm');
    this.password.set('');
    this.error.set(null);
    this.confirmVisible.set(true);
  }

  save(): void {
    if (this.pending()) {
      return;
    }
    if (this.password().trim() === '') {
      this.error.set(SHARED_T.fields.required);
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.startedAt = this.settings()?.startedAt ?? null;
    this.api.changeSettings(this.password(), this.edits()).subscribe({
      next: (changed) => {
        this.pending.set(false);
        this.edits.set({});
        if (changed.restarting) {
          this.stage.set('restarting');
          this.deadline = Date.now() + RESTART_WAIT_MS;
          this.poll = setInterval(() => {
            this.checkRestart();
          }, this.pollMs);
          return;
        }
        this.load();
        if (changed.changed.every((name) => changed.applied.includes(name))) {
          // everything is live: in force already, nothing to wait for
          this.confirmVisible.set(false);
          this.snackbar.success(T.settings.saved);
          return;
        }
        this.stage.set('manual');
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(
          problemCode(error) === 'settings.invalid'
            ? (problemDetailText(error) ?? describeError(error, T.settings.invalid))
            : describeError(error, T.settings.failed),
        );
      },
    });
  }

  /** One question to the portal while it restarts. */
  checkRestart(): void {
    if (Date.now() > this.deadline) {
      this.stopPolling();
      this.stage.set('silent');
      return;
    }
    this.api.settings().subscribe({
      next: (settings) => {
        if (settings.startedAt !== this.startedAt) {
          this.stopPolling();
          this.settings.set(settings);
          this.stage.set('done');
        }
      },
      error: () => {
        // The portal is still starting.
      },
    });
  }

  protected load(): void {
    this.api
      .settings()
      .pipe(this.state.track())
      .subscribe((settings) => {
        this.settings.set(settings);
      });
  }

  private stopPolling(): void {
    if (this.poll !== null) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }
}
