import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { HelpButton } from '@features/help/parts';
import { EmptyState } from '@shared/ui/empty-state';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';
import { AdminApi } from '../data-access/admin-api';
import { LogEntry, LogLevelName, LogResult } from '../data-access/admin.models';
import { levelSeverity, shortLogger } from '../admin-labels';
import { EventsPanel } from '../events/events-panel';
import { LoggerLevelsPanel } from './logger-levels-panel';
import { T } from '../i18n/texts';

export const PERIODS: readonly { readonly label: string; readonly minutes: number | null }[] = [
  { label: T.log.hour, minutes: 60 },
  { label: T.log.day, minutes: 1_440 },
  { label: T.log.week, minutes: 10_080 },
  { label: T.log.always, minutes: null },
];

export const MIN_LEVELS: readonly {
  readonly label: string;
  readonly level: LogLevelName | null;
}[] = [
  { label: T.log.allLevels, level: null },
  { label: T.log.infoUp, level: 'INFO' },
  { label: T.log.warnUp, level: 'WARN' },
  { label: T.log.errorOnly, level: 'ERROR' },
];

export const LOG_LIMIT = 200;

/** What the journal shows: the log, the unprocessed events and failed deliveries, or the errors of the log only. */
export type JournalView = 'log' | 'events' | 'errors';

const VIEWS: readonly JournalView[] = ['log', 'events', 'errors'];

/**
 * Administrator: «Журнал» (spec §10.5) — a list-detail of the server log with the chips «Логи · События ·
 * Ошибки». The list is the log entries (a request code from an error message finds its lines), the detail is the
 * open entry with its stack trace; without one the detail holds the temporary log levels. «События» is the
 * page of unprocessed events and failed deliveries, wide, with no detail. On one pane the entry replaces the
 * list and «back» returns.
 */
@Component({
  selector: 'tb-journal-page',
  imports: [
    EmptyState,
    HelpButton,
    DatePipe,
    ReactiveFormsModule,
    Button,
    FilterChips,
    InputText,
    Message,
    Select,
    Tag,
    EventsPanel,
    LoggerLevelsPanel,
    PageHeader,
    Pane,
    Panes,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      @if (layout.list()) {
        <tb-pane
          [kind]="current() === 'events' ? 'flexible' : 'fixed'"
          [label]="t.title"
          [class.tb-journal__pane]="current() !== 'events' && !layout.single()"
        >
          <tb-page-header [title]="t.title">
            <tb-help-button help topic="admin/diagnostics" />
          </tb-page-header>
          <tb-filter-chips
            class="tb-journal__chips"
            [label]="t.views"
            [chips]="chips"
            [value]="current()"
            (valueChange)="setView($event)"
          />

          @if (current() === 'events') {
            <tb-events-panel />
          } @else {
            <form class="tb-journal__filters" [formGroup]="form" (ngSubmit)="search()">
              <!-- every filter has its label on the outline: it stays when the field is filled (ADR-0024) -->
              <div class="tb-journal__main">
                <div class="tb-field">
                  <label for="log-period">{{ t.period }}</label>
                  <p-select
                    inputId="log-period"
                    formControlName="minutes"
                    [options]="periods"
                    optionLabel="label"
                    optionValue="minutes"
                    [fluid]="true"
                  />
                </div>
                <div class="tb-field">
                  <label for="log-text">{{ t.text }}</label>
                  <input pInputText id="log-text" formControlName="text" />
                </div>
              </div>
              <details class="tb-journal__more">
                <summary>{{ t.more }}</summary>
                <div class="tb-journal__grid">
                  @if (current() === 'log') {
                    <div class="tb-field">
                      <label for="log-level">{{ t.level }}</label>
                      <p-select
                        inputId="log-level"
                        formControlName="level"
                        [options]="levels"
                        optionLabel="label"
                        optionValue="level"
                        [fluid]="true"
                      />
                    </div>
                  }
                  <div class="tb-field">
                    <label for="log-request">{{ t.code }}</label>
                    <input pInputText id="log-request" formControlName="requestId" />
                  </div>
                  <div class="tb-field">
                    <label for="log-logger">{{ t.logger }}</label>
                    <input pInputText id="log-logger" formControlName="logger" />
                  </div>
                </div>
              </details>
              <p-button
                type="submit"
                [label]="t.find"
                severity="secondary"
                icon="tb-i tb-i-search"
                [loading]="loading()"
                [fluid]="true"
              />
            </form>

            <!-- beside the detail only the list scrolls: the header, the chips and the filters stay -->
            <div class="tb-journal__scroll">
              @if (result(); as result) {
                @if (!result.available) {
                  <p-message severity="warn">{{ t.noFile }}</p-message>
                } @else if (result.entries.length === 0) {
                  <tb-empty-state [compact]="true" icon="tb-i-search" [title]="t.nothing" />
                } @else {
                  @if (result.truncated) {
                    <p class="tb-muted">{{ t.truncated(result.entries.length) }}</p>
                  }
                  <ul class="tb-list tb-list--no-lead" [attr.aria-label]="t.entries">
                    @for (entry of result.entries; track $index) {
                      <li [class.tb-list__item--current]="selected() === entry">
                        <div class="tb-list__text">
                          <button
                            type="button"
                            class="tb-list__title tb-list__link tb-journal__row"
                            [attr.aria-current]="selected() === entry ? 'true' : null"
                            (click)="open(entry)"
                          >
                            <span class="tb-journal__message">{{ entry.message }}</span>
                          </button>
                          <span class="tb-list__supporting"
                            >{{ entry.timestamp | date: 'dd.MM HH:mm:ss' }} ·
                            {{ short(entry.logger) }}</span
                          >
                        </div>
                        <div class="tb-list__trail">
                          <p-tag [value]="entry.level" [severity]="severity(entry.level)" />
                        </div>
                      </li>
                    }
                  </ul>
                }
              }
              @if (layout.single()) {
                <tb-logger-levels-panel />
              }
            </div>
          }
        </tb-pane>
      }
      @if (current() !== 'events' && layout.detail()) {
        <tb-pane [label]="t.pickTitle">
          @if (selected(); as entry) {
            <div class="tb-journal__detail">
              @if (layout.single()) {
                <p-button
                  class="tb-journal__back"
                  [label]="t.back"
                  icon="tb-i tb-i-arrow_back"
                  [text]="true"
                  severity="secondary"
                  (onClick)="selected.set(null)"
                />
              }
              <div class="tb-journal__head">
                <p-tag [value]="entry.level" [severity]="severity(entry.level)" />
                <span class="tb-muted">{{ entry.timestamp | date: 'dd.MM.yyyy HH:mm:ss' }}</span>
              </div>
              <p class="tb-journal__text">{{ entry.message }}</p>
              <dl class="tb-journal__facts">
                <dt>{{ t.section }}</dt>
                <dd class="tb-mono">{{ entry.logger }}</dd>
                @if (entry.thread !== null) {
                  <dt>{{ t.thread }}</dt>
                  <dd class="tb-mono">{{ entry.thread }}</dd>
                }
                @if (entry.requestId !== null) {
                  <dt>{{ t.code }}</dt>
                  <dd>
                    <p-button
                      [label]="t.requestCode(entry.requestId)"
                      icon="tb-i tb-i-search"
                      [text]="true"
                      severity="secondary"
                      (onClick)="findRequest(entry)"
                    />
                  </dd>
                }
              </dl>
              @if (entry.error !== null) {
                <h2 class="tb-journal__subtitle">{{ t.details }}</h2>
                <pre class="tb-journal__trace">{{ entry.error }}</pre>
              }
            </div>
          } @else {
            <tb-empty-state icon="tb-i-list_alt" [title]="t.pickTitle" [hint]="t.pickHint" />
            <tb-logger-levels-panel />
          }
        </tb-pane>
      }
    </tb-panes>
  `,
  styles: `
    /* from expanded the pane does not scroll as a whole: its list does (our decision, as the lists of homework) */
    .tb-journal__pane ::ng-deep .tb-pane__scroll {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .tb-journal__pane .tb-journal__scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .tb-journal__chips {
      margin-block-end: var(--tb-space-4);
    }

    .tb-journal__filters {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-4);

      input {
        width: 100%;
        min-width: 0;
      }
    }

    .tb-journal__main,
    .tb-journal__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
      align-items: end;
      gap: var(--tb-space-3) var(--tb-space-2);
    }

    .tb-journal__more summary {
      margin-block-end: var(--tb-space-3);
      color: var(--p-md-primary);
      font: var(--tb-type-label-l);
      cursor: pointer;
    }

    .tb-journal__row {
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      text-align: start;
      cursor: pointer;
    }

    .tb-journal__message {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
    }

    .tb-journal__detail {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
    }

    .tb-journal__head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-journal__text {
      margin: 0;
      font: var(--tb-type-body-l);
      overflow-wrap: anywhere;
      white-space: pre-line;
    }

    .tb-journal__facts {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: var(--tb-space-1) var(--tb-space-4);
      margin: 0;

      dt {
        color: var(--p-md-on-surface-variant);
        font: var(--tb-type-label-l);
      }

      dd {
        margin: 0;
        overflow-wrap: anywhere;
      }
    }

    .tb-mono {
      font-family: var(--tb-font-mono);
      font-size: 0.85rem;
    }

    .tb-journal__subtitle {
      margin: var(--tb-space-3) 0 0;
      font: var(--tb-type-title-m);
    }

    .tb-journal__trace {
      max-height: 32rem;
      margin: 0;
      padding: var(--tb-space-4);
      overflow: auto;
      border-radius: var(--tb-shape-md);
      background: var(--p-md-surface-container-low);
      font-size: 0.8rem;
    }
  `,
})
export class JournalPage implements OnInit {
  protected readonly t = T.log;
  private readonly api = inject(AdminApi);

  /** The view from the address (`?view=events`); the log by default. */
  readonly view = input<JournalView, string | undefined>('log', {
    transform: (value) => VIEWS.find((view) => view === value) ?? 'log',
  });
  /** A request code from the address (`?requestId=`). */
  readonly requestId = input<string>();
  /** A fixed «now» for tests; the current time otherwise. */
  readonly now = input<Date | null>(null);

  protected readonly chips: readonly FilterChip<JournalView>[] = [
    { value: 'log', label: T.log.viewLog },
    { value: 'events', label: T.log.viewEvents },
    { value: 'errors', label: T.log.viewErrors },
  ];
  protected readonly periods = [...PERIODS];
  protected readonly levels = [...MIN_LEVELS];
  protected readonly result = signal<LogResult | null>(null);
  protected readonly loading = signal(false);
  /** The entry open in the detail. */
  protected readonly selected = signal<LogEntry | null>(null);
  protected readonly layout = injectListDetail(() => this.selected() !== null);
  /** The view the user chose; the address sets the first one. */
  private readonly chosen = signal<JournalView | null>(null);
  protected readonly current = computed(() => this.chosen() ?? this.view());

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
    if (this.view() === 'errors') {
      this.form.patchValue({ level: 'ERROR' });
    }
    if (this.view() !== 'events') {
      this.search();
    }
  }

  protected severity(level: string): ReturnType<typeof levelSeverity> {
    return levelSeverity(level);
  }

  protected short(logger: string): string {
    return shortLogger(logger);
  }

  protected open(entry: LogEntry): void {
    this.selected.set(entry);
  }

  /** A chip: «Ошибки» search the level ERROR, the others every level; «События» show their own page. */
  protected setView(view: JournalView): void {
    this.chosen.set(view);
    this.selected.set(null);
    if (view === 'events') {
      return;
    }
    this.form.patchValue({ level: view === 'errors' ? 'ERROR' : null });
    this.search();
  }

  findRequest(entry: LogEntry): void {
    this.form.patchValue({
      requestId: entry.requestId ?? '',
      minutes: null,
      level: null,
      text: '',
      logger: '',
    });
    this.selected.set(null);
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
