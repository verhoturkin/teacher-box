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
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { describeError } from '@core/http/error-messages';
import { HelpButton } from '@features/help/parts';
import { problemCode, problemDetailText } from '@core/http/problem-detail';
import { RESTART_POLL_MS, RESTART_WAIT_MS } from '@shared/restart/restart-wait';
import { AdminApi } from '../data-access/admin-api';
import {
  AdminSetting,
  AdminSettings,
  SettingKind,
  SettingSource,
} from '../data-access/admin.models';
import { TimeZoneOption, timeZoneOptions } from './time-zones';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { SubmitFor } from '@shared/ui/submit-for';
import { PageHeader } from '@shared/ui/page-header';
import { PaneNav, PaneNavItem } from '@shared/ui/pane-nav';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';
import { pageDetail } from '@core/routing/page-detail';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

type Stage = 'confirm' | 'restarting' | 'manual' | 'done' | 'silent';

interface Group {
  /** The key in the address: `?open=ai,backups`. */
  readonly section: string;
  readonly name: string;
  /** A line under the title: what the section is about. */
  readonly summary: string;
  readonly editable: readonly AdminSetting[];
  /** Shown, not changed here: Docker and the accounts. */
  readonly fixed: readonly AdminSetting[];
  /** The hint shared by all of `fixed`: shown once above them, not in every row. */
  readonly note: string | null;
}

/** The line under a section's title, by its key; an unknown section names its first settings. */
const SUMMARIES: Readonly<Record<string, string>> = T.settings.summaries;

/** The icon of a section in the list; an unknown one gets the cog. */
const SECTION_ICONS: Readonly<Record<string, string>> = {
  portal: 'tb-i-palette',
  billing: 'tb-i-account_balance_wallet',
  homework: 'tb-i-badge',
  schedule: 'tb-i-calendar_month',
  meetings: 'tb-i-videocam',
  boards: 'tb-i-palette',
  notifications: 'tb-i-chat',
  ai: 'tb-i-auto_awesome',
  sessions: 'tb-i-lock',
  backups: 'tb-i-database',
  log: 'tb-i-list_alt',
  accounts: 'tb-i-badge',
  docker: 'tb-i-deployed_code',
};

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
  TIME_ZONE: T.settings.placeholders.TIME_ZONE,
  CURRENCY: 'RUB',
  NUMBER: T.settings.placeholders.NUMBER,
};

/** A section: its fields, what cannot be changed here, the line under its title. */
function toGroup(settings: readonly AdminSetting[]): Group {
  const [first] = settings;
  const editable = settings.filter((setting) => setting.access === 'EDITABLE');
  const fixed = settings.filter((setting) => setting.access !== 'EDITABLE');
  const notes = new Set(fixed.map((setting) => setting.hint));
  const [note] = notes;
  const section = first?.section ?? '';
  return {
    section,
    name: first?.group ?? '',
    summary:
      SUMMARIES[section] ??
      settings
        .slice(0, 2)
        .map((setting) => setting.title)
        .join(', '),
    editable,
    fixed,
    note: fixed.length > 1 && notes.size === 1 && note !== '' ? (note ?? null) : null,
  };
}

/**
 * The administrator's settings of the portal (ADR-0016): every variable of `.env` by section, where
 * its value comes from, changes that are more important than `.env` and a restart that applies them.
 * List-detail (247.2): the sections in the fixed pane, the chosen one (`/admin/settings/:section`) beside it;
 * on compact `/admin/settings` is the list and a section has «back» to it. The edits of all sections are saved
 * together.
 */
@Component({
  selector: 'tb-admin-settings-page',
  imports: [
    FormsModule,
    Button,
    NgTemplateOutlet,
    Panes,
    Pane,
    PaneNav,
    Dialog,
    HelpButton,
    InputText,
    Message,
    Select,
    SubmitFor,
    Tag,
    PageHeader,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes medium="two">
      @if (layout.list()) {
        <tb-pane kind="fixed" [label]="t.sections">
          <tb-page-header tbPaneHeader [title]="t.title">
            <tb-help-button help topic="admin/settings" />
            <ng-container [ngTemplateOutlet]="saveButton" />
          </tb-page-header>
          <div class="tb-stack">
            <p class="tb-hint">{{ t.about }}</p>
            @if (settings()?.restartNeeded) {
              <p-message severity="warn" styleClass="tb-form-message">{{
                t.restartNeeded
              }}</p-message>
            }
            <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
              <tb-pane-nav
                [items]="items()"
                base="/admin/settings"
                [current]="layout.detail() ? (currentGroup()?.section ?? null) : null"
                [label]="t.sections"
              />
            </tb-load-state>
          </div>
        </tb-pane>
      }
      @if (layout.detail()) {
        <tb-pane [label]="currentGroup()?.name ?? t.title">
          <div tbPaneHeader>
            @if (layout.single()) {
              <tb-page-header
                [title]="currentGroup()?.name ?? t.title"
                back="/admin/settings"
                [backLabel]="t.all"
              >
                <ng-container [ngTemplateOutlet]="saveButton" />
              </tb-page-header>
            } @else {
              <h2 class="tb-settings__heading">{{ currentGroup()?.name }}</h2>
            }
            <p class="tb-hint tb-settings__summary">{{ currentGroup()?.summary }}</p>
          </div>
          @if (layout.single()) {
            <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
              <ng-container [ngTemplateOutlet]="detail" />
            </tb-load-state>
          } @else {
            <ng-container [ngTemplateOutlet]="detail" />
          }
        </tb-pane>
      }
    </tb-panes>

    <ng-template #saveButton>
      <p-button
        [label]="t.saveAndRestart"
        icon="tb-i tb-i-save"
        [disabled]="changes() === 0"
        (onClick)="openConfirm()"
      />
    </ng-template>

    <ng-template #detail>
      @if (currentGroup(); as group) {
        <div class="tb-settings">
          @for (setting of group.editable; track setting.name) {
            <div class="tb-field tb-setting">
              <label [for]="'setting-' + setting.name">{{ setting.title }}</label>
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
              } @else if (setting.kind === 'TIME_ZONE') {
                <p-select
                  [inputId]="'setting-' + setting.name"
                  [options]="timeZones()"
                  optionLabel="label"
                  optionValue="value"
                  [filter]="true"
                  filterBy="label"
                  [filterPlaceholder]="t.zoneFilter"
                  [placeholder]="placeholder(setting)"
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
              @if (setting.hint !== '') {
                <small class="tb-hint">{{ setting.hint }}</small>
              }
              <div class="tb-setting__meta">
                <code class="tb-setting__name">{{ setting.name }}</code>
                <p-tag
                  [value]="sources[setting.source]"
                  [severity]="setting.source === 'ADMIN' ? 'info' : 'secondary'"
                />
                @if (edited(setting)) {
                  <p-tag [value]="t.edited" severity="warn" />
                }
                @if (setting.source === 'ADMIN') {
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
            </div>
          }
          @if (group.fixed.length > 0) {
            <!-- what cannot be changed here is data, not fields: a segmented list -->
            @if (group.note; as note) {
              <p class="tb-hint">{{ note }}</p>
            }
            <ul class="tb-list">
              @for (setting of group.fixed; track setting.name) {
                <li class="tb-setting">
                  <span class="tb-list__lead" aria-hidden="true"
                    ><i
                      [class]="
                        setting.access === 'DOCKER' ? 'tb-i tb-i-deployed_code' : 'tb-i tb-i-lock'
                      "
                    ></i
                  ></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ setting.title }}</span>
                    <span class="tb-list__supporting" [id]="'setting-' + setting.name">{{
                      shown(setting)
                    }}</span>
                    <code class="tb-setting__name">{{ setting.name }}</code>
                    @if (setting.hint !== '' && group.note === null) {
                      <small class="tb-hint">{{ setting.hint }}</small>
                    }
                  </div>
                  <span class="tb-list__trail">
                    <p-tag
                      [value]="sources[setting.source]"
                      [severity]="setting.source === 'ADMIN' ? 'info' : 'secondary'"
                    />
                  </span>
                </li>
              }
            </ul>
          }
        </div>
      }
    </ng-template>

    <p-dialog
      [header]="t.confirmTitle"
      [(visible)]="confirmVisible"
      [modal]="true"
      [closable]="stage() !== 'restarting'"
      styleClass="tb-dialog tb-dialog--short"
      [draggable]="false"
    >
      @switch (stage()) {
        @case ('confirm') {
          <form id="settings-confirm" class="tb-form" (ngSubmit)="save()">
            <p>{{ t.changes(changes()) }}</p>
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
            @if (error(); as message) {
              <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
            }
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
      <ng-template #footer>
        @if (stage() === 'confirm') {
          <p-button
            [label]="c.cancel"
            severity="secondary"
            [text]="true"
            (onClick)="confirmVisible.set(false)"
          />
          <p-button
            [label]="c.save"
            [loading]="pending()"
            [disabled]="password().trim() === ''"
            type="submit"
            tbSubmitFor="settings-confirm"
          />
        } @else if (stage() !== 'restarting') {
          <p-button [label]="t.finish" (onClick)="confirmVisible.set(false)" />
        }
      </ng-template>
    </p-dialog>
  `,
  styles: `
    /* One setting under another (ADR-0021): the fields first, then what cannot be changed here */
    .tb-settings {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-6);
    }

    .tb-settings__heading {
      margin: 0 0 var(--tb-space-2);
      font: var(--tb-type-headline-s-emphasized);
    }

    .tb-settings__summary {
      margin: 0 0 var(--tb-space-6);
    }

    .tb-setting__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-setting__revert {
      margin-inline-start: auto;
    }

    .tb-setting__name {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
      font-family: var(--tb-font-mono);
      overflow-wrap: anywhere;
    }
  `,
})
export class SettingsPage implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.settings;
  private readonly api = inject(AdminApi);
  private readonly pollMs = inject(RESTART_POLL_MS);

  protected readonly sources = SOURCE_LABELS;
  protected readonly settings = signal<AdminSettings | null>(null);
  protected readonly state = new LoadState();
  /** Changed values by variable name; `null`: back to `.env`. */
  protected readonly edits = signal<Readonly<Record<string, string | null>>>({});
  protected readonly changes = computed(() => Object.keys(this.edits()).length);
  protected readonly groups = computed<Group[]>(() => {
    const sections = new Map<string, AdminSetting[]>();
    for (const setting of this.settings()?.settings ?? []) {
      sections.set(setting.section, [...(sections.get(setting.section) ?? []), setting]);
    }
    return [...sections.values()].map((settings) => toGroup(settings));
  });

  /** Route parameter: the chosen section; none — the list (beside it the first section). */
  readonly section = input<string>();
  protected readonly layout = injectListDetail(() => this.section() !== undefined, 'two');
  protected readonly currentGroup = computed<Group | null>(() => {
    const groups = this.groups();
    return groups.find((group) => group.section === this.section()) ?? groups[0] ?? null;
  });
  protected readonly items = computed<PaneNavItem[]>(() =>
    this.groups().map((group) => ({
      id: group.section,
      icon: SECTION_ICONS[group.section] ?? 'tb-i-settings',
      title: group.name,
      summary: group.summary,
      badge: this.editedIn(group),
    })),
  );

  /** Known time zones, and the one in force if the browser does not know it (e.g. an old name). */
  protected readonly timeZones = computed<TimeZoneOption[]>(() => {
    const known = timeZoneOptions();
    const unknown = (this.settings()?.settings ?? [])
      .filter((setting) => setting.kind === 'TIME_ZONE' && setting.value !== null)
      .map((setting) => setting.value ?? '')
      .filter((value) => value !== '' && !known.some((zone) => zone.value === value));
    return [
      { label: T.settings.notSet, value: '' },
      ...[...new Set(unknown)].map((value) => ({ label: value, value })),
      ...known,
    ];
  });

  protected readonly confirmVisible = signal(false);
  protected readonly stage = signal<Stage>('confirm');
  protected readonly password = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  private startedAt: string | null = null;
  private deadline = 0;
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor() {
    pageDetail(() => (this.layout.detail() ? this.currentGroup()?.name : null));
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

  /** Unsaved changes of a section: the badge of its item in the list. */
  protected editedIn(group: Group): number {
    return group.editable.filter((setting) => this.edited(setting)).length;
  }

  protected shown(setting: AdminSetting): string {
    if (setting.secret) {
      return setting.set ? T.settings.secretSet : T.settings.secretNotSet;
    }
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
    if (this.pending() || this.password().trim() === '') {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.startedAt = this.settings()?.startedAt ?? null;
    this.api.changeSettings(this.password(), this.edits()).subscribe({
      next: (changed) => {
        this.pending.set(false);
        this.edits.set({});
        if (!changed.restarting) {
          this.stage.set('manual');
          this.load();
          return;
        }
        this.stage.set('restarting');
        this.deadline = Date.now() + RESTART_WAIT_MS;
        this.poll = setInterval(() => {
          this.checkRestart();
        }, this.pollMs);
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
