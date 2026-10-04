import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
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
import { PageHeader } from '@shared/ui/page-header';

type Stage = 'confirm' | 'restarting' | 'manual' | 'done' | 'silent';

interface Group {
  readonly name: string;
  readonly settings: readonly AdminSetting[];
}

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

/**
 * The administrator's settings of the portal (ADR-0016): every variable of `.env` by section, where
 * its value comes from, changes that are more important than `.env` and a restart that applies them.
 */
@Component({
  selector: 'tb-admin-settings-page',
  imports: [
    FormsModule,
    Button,
    Card,
    Dialog,
    HelpButton,
    InputText,
    Message,
    Select,
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
    <div class="tb-stack tb-stack--narrow">
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
        @for (group of groups(); track group.name) {
          <p-card [header]="group.name">
            <div class="tb-settings">
              @for (setting of group.settings; track setting.name) {
                <div class="tb-setting">
                  <div class="tb-setting__head">
                    <!-- a value that cannot be changed is text, not a field: the label is for fields only -->
                    <label
                      [attr.for]="setting.access === 'EDITABLE' ? 'setting-' + setting.name : null"
                      >{{ setting.title }}</label
                    >
                    <p-tag
                      [value]="sources[setting.source]"
                      [severity]="setting.source === 'ADMIN' ? 'info' : 'secondary'"
                    />
                    @if (edited(setting)) {
                      <p-tag value="изменено" severity="warn" />
                    }
                  </div>
                  <code class="tb-setting__name">{{ setting.name }}</code>
                  @if (setting.access !== 'EDITABLE') {
                    <span class="tb-setting__value" [id]="'setting-' + setting.name">{{
                      shown(setting)
                    }}</span>
                  } @else if (setting.kind === 'CHOICE' || setting.kind === 'BOOLEAN') {
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
                    <small class="tb-muted">{{ setting.hint }}</small>
                  }
                  @if (setting.source === 'ADMIN' && setting.access === 'EDITABLE') {
                    <p-button
                      label="Вернуть как в .env"
                      severity="danger"
                      [text]="true"
                      (onClick)="revert(setting)"
                    />
                  }
                </div>
              }
            </div>
          </p-card>
        }
      </tb-load-state>
    </div>

    <p-dialog
      header="Сохранить настройки"
      [(visible)]="confirmVisible"
      [modal]="true"
      [closable]="stage() !== 'restarting'"
      [style]="{ width: '30rem' }"
      [draggable]="false"
    >
      @switch (stage()) {
        @case ('confirm') {
          <div class="tb-form">
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
                autocomplete="current-password"
                [(ngModel)]="password"
              />
            </div>
            @if (error(); as message) {
              <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
            }
          </div>
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
            (onClick)="save()"
          />
        } @else if (stage() !== 'restarting') {
          <p-button label="Готово" (onClick)="confirmVisible.set(false)" />
        }
      </ng-template>
    </p-dialog>
  `,
  styles: `
    /* One setting under another (ADR-0021) */
    .tb-settings {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-5);
    }

    .tb-setting {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      min-width: 0;

      label {
        font: var(--tb-type-label-l);
      }
    }

    .tb-setting__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-setting__name {
      font: var(--tb-type-body-s);
      color: var(--p-text-muted-color);
      overflow-wrap: anywhere;
    }

    .tb-setting__value {
      padding: var(--tb-space-2) 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class SettingsPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly pollMs = inject(RESTART_POLL_MS);

  protected readonly sources = SOURCE_LABELS;
  protected readonly settings = signal<AdminSettings | null>(null);
  protected readonly state = new LoadState();
  /** Changed values by variable name; `null`: back to `.env`. */
  protected readonly edits = signal<Readonly<Record<string, string | null>>>({});
  protected readonly changes = computed(() => Object.keys(this.edits()).length);
  protected readonly groups = computed<Group[]>(() => {
    const groups: Group[] = [];
    for (const setting of this.settings()?.settings ?? []) {
      const last = groups.at(-1);
      if (last?.name === setting.group) {
        groups[groups.length - 1] = { name: last.name, settings: [...last.settings, setting] };
      } else {
        groups.push({ name: setting.group, settings: [setting] });
      }
    }
    return groups;
  });

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
