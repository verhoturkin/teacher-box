import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { RowType } from '@shared/ui/row-type.directive';
import { AdminApi } from '../data-access/admin-api';
import { LogEntry, LogLevelName, LogResult } from '../data-access/admin.models';
import { levelSeverity, shortLogger } from '../admin-labels';
import { LoggerLevelsPanel } from './logger-levels-panel';

export const PERIODS: readonly { readonly label: string; readonly minutes: number | null }[] = [
  { label: 'Последний час', minutes: 60 },
  { label: 'Последние сутки', minutes: 1_440 },
  { label: 'Последние 7 дней', minutes: 10_080 },
  { label: 'Всё время', minutes: null },
];

export const MIN_LEVELS: readonly { readonly label: string; readonly level: LogLevelName | null }[] = [
  { label: 'Все уровни', level: null },
  { label: 'INFO и важнее', level: 'INFO' },
  { label: 'WARN и ERROR', level: 'WARN' },
  { label: 'Только ERROR', level: 'ERROR' },
];

export const LOG_LIMIT = 200;

/** Administrator: search in the server log; a request code from an error message finds its lines. */
@Component({
  selector: 'tb-log-page',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    Button,
    Card,
    InputText,
    Message,
    Select,
    TableModule,
    Tag,
    RowType,
    LoggerLevelsPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Журнал</h1>
    <div class="tb-stack">
      <p-card>
        <form class="tb-log-filters" [formGroup]="form" (ngSubmit)="search()">
          <p-select
            formControlName="minutes"
            [options]="periods"
            optionLabel="label"
            optionValue="minutes"
            ariaLabel="Период"
          />
          <p-select formControlName="level" [options]="levels" optionLabel="label" optionValue="level" ariaLabel="Уровень" />
          <input pInputText formControlName="requestId" placeholder="Код ошибки" aria-label="Код ошибки" />
          <input pInputText formControlName="text" placeholder="Текст" aria-label="Текст" />
          <input pInputText formControlName="logger" placeholder="Раздел (логгер)" aria-label="Раздел" />
          <p-button type="submit" label="Найти" icon="pi pi-search" [loading]="loading()" />
        </form>
      </p-card>

      @if (result(); as result) {
        <p-card>
          @if (!result.available) {
            <p-message severity="warn">
              Журнал не пишется в файл (параметр logging.file.name пуст) — искать негде.
            </p-message>
          } @else if (result.entries.length === 0) {
            <p class="tb-muted">Ничего не найдено.</p>
          } @else {
            @if (result.truncated) {
              <p class="tb-muted">Показаны последние {{ result.entries.length }} записей — уточните поиск.</p>
            }
            <p-table [value]="result.entries" styleClass="p-datatable-sm tb-log-table">
              <ng-template #header>
                <tr>
                  <th>Время</th>
                  <th>Уровень</th>
                  <th>Раздел</th>
                  <th>Сообщение</th>
                </tr>
              </ng-template>
              <ng-template #body let-entry [tbRowType]="result.entries">
                <tr>
                  <td class="tb-log-time">{{ entry.timestamp | date: 'dd.MM HH:mm:ss' }}</td>
                  <td><p-tag [value]="entry.level" [severity]="severity(entry.level)" /></td>
                  <td class="tb-log-logger" [title]="entry.logger">{{ short(entry.logger) }}</td>
                  <td class="tb-log-message">
                    <div>{{ entry.message }}</div>
                    @if (entry.requestId !== null) {
                      <button type="button" class="tb-log-code" (click)="findRequest(entry)">
                        код {{ entry.requestId }}
                      </button>
                    }
                    @if (entry.error !== null) {
                      <details>
                        <summary>Подробности ошибки</summary>
                        <pre>{{ entry.error }}</pre>
                      </details>
                    }
                  </td>
                </tr>
              </ng-template>
            </p-table>
          }
        </p-card>
      }

      <tb-logger-levels-panel />
    </div>
  `,
  styles: `
    .tb-log-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;

      input {
        min-width: 10rem;
      }
    }

    .tb-log-time {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .tb-log-logger {
      font-family: monospace;
      font-size: 0.85rem;
      overflow-wrap: anywhere;
    }

    .tb-log-message {
      overflow-wrap: anywhere;
      white-space: pre-line;

      pre {
        max-height: 20rem;
        overflow: auto;
        font-size: 0.8rem;
        white-space: pre;
      }
    }

    .tb-log-code {
      padding: 0;
      border: 0;
      background: none;
      color: var(--p-primary-color);
      font: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }
  `,
})
export class LogPage implements OnInit {
  private readonly api = inject(AdminApi);

  /** A request code from the address (`?requestId=`). */
  readonly requestId = input<string>();
  /** A fixed «now» for tests; the current time otherwise. */
  readonly now = input<Date | null>(null);

  protected readonly periods = [...PERIODS];
  protected readonly levels = [...MIN_LEVELS];
  protected readonly result = signal<LogResult | null>(null);
  protected readonly loading = signal(false);

  readonly form = new FormGroup({
    minutes: new FormControl<number | null>(1_440),
    level: new FormControl<LogLevelName | null>(null),
    requestId: new FormControl('', { nonNullable: true }),
    text: new FormControl('', { nonNullable: true }),
    logger: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    const requestId = this.requestId();
    if (requestId !== undefined && requestId !== '') {
      this.form.patchValue({ requestId, minutes: null });
    }
    this.search();
  }

  protected severity(level: string): ReturnType<typeof levelSeverity> {
    return levelSeverity(level);
  }

  protected short(logger: string): string {
    return shortLogger(logger);
  }

  findRequest(entry: LogEntry): void {
    this.form.patchValue({ requestId: entry.requestId ?? '', minutes: null, level: null, text: '', logger: '' });
    this.search();
  }

  search(): void {
    const value = this.form.getRawValue();
    const from =
      value.minutes === null
        ? null
        : new Date((this.now() ?? new Date()).getTime() - value.minutes * 60_000).toISOString();
    this.loading.set(true);
    this.api
      .logs({
        from,
        level: value.level,
        logger: value.logger,
        text: value.text,
        requestId: value.requestId,
        limit: LOG_LIMIT,
      })
      .subscribe({
        next: (result) => {
          this.loading.set(false);
          this.result.set(result);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }
}
