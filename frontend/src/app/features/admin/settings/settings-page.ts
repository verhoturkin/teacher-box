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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { FoldCard } from '@shared/ui/fold-card';

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
const SUMMARIES: Readonly<Record<string, string>> = {
  portal: 'Адрес портала и часовой пояс',
  billing: 'Валюта и длительность занятия для оплат',
  homework: 'Файлы ответов и напоминание о сроке сдачи',
  schedule: 'Длительность, регулярные занятия, напоминания, Google Календарь',
  meetings: 'Яндекс Телемост: приложение и токен',
  boards: 'Ежедневные копии досок',
  notifications: 'Боты Telegram, ВКонтакте и MAX, доставка сообщений',
  ai: 'Сервис, модель, ключ и лимиты',
  sessions: 'Сроки входа и приглашений, защита от подбора пароля',
  backups: 'Расписание копий, сколько хранить, перезапуск',
  log: 'Формат, размер и хранение журнала',
  accounts: 'Логины и пароли учителя и администратора',
  docker: 'Порт, домен, образ и ресурсы контейнера',
};

interface Option {
  readonly label: string;
  readonly value: string;
}

const SOURCE_LABELS: Readonly<Record<SettingSource, string>> = {
  DEFAULT: 'по умолчанию',
  ENVIRONMENT: 'из .env',
  ADMIN: 'задано здесь',
};

const PLACEHOLDERS: Readonly<Partial<Record<SettingKind, string>>> = {
  DURATION: 'например 15m, 24h, 7d',
  DURATIONS: 'например 24h,1h',
  DATA_SIZE: 'например 20MB',
  CRON: 'например 0 30 3 * * *',
  ADDRESS: 'https://school.example.com',
  URL: 'https://…',
  PROXY: 'socks5://host:port',
  TIME_ZONE: 'выберите часовой пояс',
  CURRENCY: 'RUB',
  NUMBER: 'число',
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
 * The sections fold (design system §4); the open ones are in the address (`?open=ai,backups`).
 */
@Component({
  selector: 'tb-admin-settings-page',
  imports: [
    FormsModule,
    Button,
    FoldCard,
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
    <tb-page-header title="Настройки">
      <tb-help-button help topic="admin/settings" />
      <p-button
        severity="success"
        label="Сохранить и перезапустить"
        icon="pi pi-save"
        [disabled]="changes() === 0"
        (onClick)="openConfirm()"
      />
    </tb-page-header>
    <div class="tb-stack">
      <p class="tb-hint">
        Значения, заданные здесь, важнее файла .env и применяются после перезапуска портала. Пароли,
        токены и ключи не показываются — их можно только задать заново.
      </p>
      @if (settings()?.restartNeeded) {
        <p-message severity="warn" styleClass="tb-form-message">
          Сохранённые настройки применятся после перезапуска портала.
        </p-message>
      }
      <tb-load-state [state]="state" what="настройки" (retry)="load()">
        <div class="tb-stack">
          @for (group of groups(); track group.section) {
            <tb-fold-card
              [id]="'settings-' + group.section"
              [title]="group.name"
              [summary]="group.summary"
              [badge]="editedIn(group)"
              [open]="opened().has(group.section)"
              (openChange)="fold(group.section, $event)"
            >
              <ng-template>
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
                          filterPlaceholder="Город или смещение, например Moscow"
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
                          <p-tag value="изменено" severity="warn" />
                        }
                        @if (setting.source === 'ADMIN') {
                          <p-button
                            class="tb-setting__revert"
                            label="Вернуть как в .env"
                            severity="danger"
                            [text]="true"
                            [ariaLabel]="'Вернуть как в .env: ' + setting.title"
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
                              [class]="setting.access === 'DOCKER' ? 'pi pi-box' : 'pi pi-lock'"
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
              </ng-template>
            </tb-fold-card>
          }
        </div>
      </tb-load-state>
    </div>

    <p-dialog
      header="Сохранить настройки"
      [(visible)]="confirmVisible"
      [modal]="true"
      [closable]="stage() !== 'restarting'"
      styleClass="tb-dialog tb-dialog--short"
      [draggable]="false"
    >
      @switch (stage()) {
        @case ('confirm') {
          <form id="settings-confirm" class="tb-form" (ngSubmit)="save()">
            <p>
              Изменится настроек: {{ changes() }}. После сохранения портал перезапустится — на
              минуту он будет недоступен всем.
            </p>
            <div class="tb-field">
              <label for="settings-password">Ваш пароль</label>
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
          <p>Портал перезапускается, чтобы применить настройки…</p>
        }
        @case ('manual') {
          <p>
            Настройки сохранены. Портал запущен не в Docker — перезапустите его вручную, чтобы они
            применились.
          </p>
        }
        @case ('done') {
          <p>Портал перезапущен, настройки применены.</p>
        }
        @case ('silent') {
          <p>
            Портал не ответил за пять минут. Проверьте журнал контейнера: возможно, какое-то
            значение мешает запуску — его можно исправить в файле config/settings.properties в папке
            данных.
          </p>
        }
      }
      <ng-template #footer>
        @if (stage() === 'confirm') {
          <p-button
            label="Отмена"
            severity="secondary"
            [text]="true"
            (onClick)="confirmVisible.set(false)"
          />
          <p-button
            severity="success"
            label="Сохранить"
            [loading]="pending()"
            [disabled]="password().trim() === ''"
            type="submit"
            tbSubmitFor="settings-confirm"
          />
        } @else if (stage() !== 'restarting') {
          <p-button label="Готово" (onClick)="confirmVisible.set(false)" />
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
  private readonly api = inject(AdminApi);
  private readonly pollMs = inject(RESTART_POLL_MS);
  private readonly router = inject(Router);

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

  /** The open sections (query parameter), e.g. `ai,backups`. */
  readonly open = input<string>();
  protected readonly opened = computed(
    () => new Set((this.open() ?? '').split(',').filter((section) => section !== '')),
  );

  /** Known time zones, and the one in force if the browser does not know it (e.g. an old name). */
  protected readonly timeZones = computed<TimeZoneOption[]>(() => {
    const known = timeZoneOptions();
    const unknown = (this.settings()?.settings ?? [])
      .filter((setting) => setting.kind === 'TIME_ZONE' && setting.value !== null)
      .map((setting) => setting.value ?? '')
      .filter((value) => value !== '' && !known.some((zone) => zone.value === value));
    return [
      { label: 'не задано', value: '' },
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

  /** Unsaved changes of a section: a badge next to its title, seen while it is folded. */
  protected editedIn(group: Group): number {
    return group.editable.filter((setting) => this.edited(setting)).length;
  }

  /** Keeps the open sections in the address, in the order of the page. */
  fold(section: string, open: boolean): void {
    const next = new Set(this.opened());
    if (open) {
      next.add(section);
    } else {
      next.delete(section);
    }
    const sections = this.groups()
      .map((group) => group.section)
      .filter((name) => next.has(name))
      .join(',');
    void this.router.navigate([], {
      queryParams: { open: sections === '' ? null : sections },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected shown(setting: AdminSetting): string {
    if (setting.secret) {
      return setting.set ? 'задан' : 'не задан';
    }
    return setting.value === null || setting.value === '' ? 'не задано' : setting.value;
  }

  protected placeholder(setting: AdminSetting): string {
    if (setting.secret) {
      return setting.set ? 'задан — введите новый, чтобы сменить' : 'не задан';
    }
    return PLACEHOLDERS[setting.kind] ?? '';
  }

  protected options(setting: AdminSetting): Option[] {
    const values =
      setting.kind === 'BOOLEAN'
        ? [
            { label: 'да (true)', value: 'true' },
            { label: 'нет (false)', value: 'false' },
          ]
        : setting.choices.map((choice) => ({ label: choice, value: choice }));
    return [{ label: 'не задано', value: '' }, ...values];
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
            ? (problemDetailText(error) ?? describeError(error, 'Значение не подходит'))
            : describeError(error, 'Не удалось сохранить настройки'),
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
