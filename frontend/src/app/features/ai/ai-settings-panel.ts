import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { locale } from '@core/i18n/language';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { Snackbar } from '@core/snackbar/snackbar';
import { Tag } from 'primeng/tag';
import { AiApi } from './data-access/ai-api';
import { AiFeature, AiRequestLog, AiRequestStatus, UsageReport } from './data-access/ai.models';
import { AiConnectionsCard } from './ai-connections-card';
import { AiSetup } from './ai-setup';
import { dayTime } from '@shared/dates/iso-date';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from './i18n/texts';
import { PromptLibraryCard } from './prompt-library-card';
import { SystemPromptsCard } from './system-prompts-card';

/** The icon of a request in the log: the kind of draft. */
const FEATURE_ICONS: Record<AiFeature, string> = {
  HOMEWORK_DRAFT: 'tb-i tb-i-assignment',
  REVIEW_DRAFT: 'tb-i tb-i-rate_review',
  LESSON_SUMMARY: 'tb-i tb-i-summarize',
  QUIZ_DRAFT: 'tb-i tb-i-quiz',
};

type TagSeverity = 'success' | 'danger' | 'secondary';

const STATUS_LABELS: Record<AiRequestStatus, { label: string; severity: TagSeverity }> = {
  SUCCEEDED: { label: T.statuses.SUCCEEDED, severity: 'success' },
  FAILED: { label: T.statuses.FAILED, severity: 'danger' },
  REFUSED: { label: T.statuses.REFUSED, severity: 'secondary' },
};

/** The bar's segments by model in the sketch's order: primary, its light pair, tertiary, secondary. */
const SEGMENT_COLORS = [
  'var(--p-md-primary)',
  'var(--p-md-inverse-primary)',
  'var(--p-md-tertiary)',
  'var(--p-md-secondary)',
  'var(--p-md-outline)',
];

interface UsagePart {
  readonly key: string;
  readonly label: string;
  readonly percent: number;
  readonly color: string;
}

/**
 * The settings category «ИИ-помощник» (sketch Ai, ADR-0057): the connections with their models and the
 * default one, the month's usage split by model with the monthly limit, the log of recent requests, the
 * library of prompts (the editor's «Промты» menu leads here) and the system prompts.
 */
@Component({
  selector: 'tb-ai-settings-panel',
  imports: [
    DecimalPipe,
    FormsModule,
    Button,
    Card,
    InputNumber,
    Tag,
    EmptyState,
    AiConnectionsCard,
    PromptLibraryCard,
    SystemPromptsCard,
  ],
  providers: [AiSetup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-ai">
      <div class="tb-ai__stack">
        <tb-ai-connections-card />
        <p-card styleClass="tb-section-card tb-section-card--flow">
          <ng-template #title>
            {{ report() === null ? t.usageTitle : t.usageOf(monthName(report()?.month ?? '')) }}
          </ng-template>
          @if (report(); as report) {
            @if (limit() > 0) {
              <p class="tb-ai__usage">
                <strong class="tb-ai__percent">{{ percent(report.usedTokens) }} %</strong>
                <span class="tb-muted">{{
                  t.ofMonthLimit(
                    (report.usedTokens | number) ?? '',
                    (limit() | number) ?? '',
                    resetDay(report.month)
                  )
                }}</span>
              </p>
            } @else {
              <p class="tb-ai__usage">
                <strong class="tb-ai__percent">{{ report.usedTokens | number }}</strong>
                <span class="tb-muted">{{ t.tokensNoLimit }}</span>
              </p>
            }
            @if (parts().length > 0) {
              <div class="tb-ai__bar" role="img" [attr.aria-label]="t.used">
                @for (part of parts(); track part.key) {
                  <i [style.width.%]="part.percent" [style.background]="part.color"></i>
                }
              </div>
              <ul class="tb-ai__legend">
                @for (part of parts(); track part.key) {
                  <li>
                    <i [style.background]="part.color"></i>{{ part.label }} · {{ part.percent }} %
                  </li>
                }
              </ul>
            }
          }
          @if (setup.settings(); as settings) {
            <div class="tb-field">
              <label for="ai-limit">{{ t.limit }}</label>
              <p-inputnumber
                inputId="ai-limit"
                [ngModel]="settings.monthlyTokenLimit"
                (ngModelChange)="limitDraft.set($event)"
                [min]="0"
                [useGrouping]="true"
                [locale]="numberLocale"
                [fluid]="true"
                (onBlur)="saveLimit()"
                (keydown.enter)="saveLimit()"
              />
              <small class="tb-hint">{{ t.limitHint }}</small>
            </div>
          }
        </p-card>
        @if (report(); as report) {
          <p-card
            [header]="t.recent(monthName(report.month))"
            styleClass="tb-section-card tb-section-card--flow"
          >
            @if (recent().length === 0) {
              <tb-empty-state [compact]="true" icon="tb-i-auto_awesome" [title]="t.noRequests" />
            } @else {
              <ul class="tb-list" [attr.aria-label]="t.recent(monthName(report.month))">
                @for (row of recent(); track $index) {
                  <li>
                    <span class="tb-list__lead" aria-hidden="true"
                      ><i [class]="featureIcons[row.feature]"></i
                    ></span>
                    <div class="tb-list__text">
                      <span class="tb-list__title">{{ featureLabel(row.feature) }}</span>
                      <span class="tb-list__supporting">
                        {{ when(row.createdAt) }} · {{ row.model }} ·
                        {{ t.inOut(row.inputTokens, row.outputTokens) }} ·
                        {{ t.seconds((row.durationMs / 1000 | number: '1.0-0') ?? '') }}
                      </span>
                      @if (row.error) {
                        <small class="tb-negative tb-ai__error">{{ row.error }}</small>
                      }
                    </div>
                    <div class="tb-list__trail">
                      <p-tag [value]="statusOf(row).label" [severity]="statusOf(row).severity" />
                    </div>
                  </li>
                }
              </ul>
              @if (moreRecent()) {
                <p-button
                  [label]="t.showMore"
                  [text]="true"
                  [loading]="loadingMore()"
                  (onClick)="showMore(report.month)"
                />
              }
            }
          </p-card>
        }
      </div>
      <div class="tb-ai__stack">
        <tb-prompt-library-card />
        <tb-system-prompts-card />
      </div>
    </div>
  `,
  styles: `
    /* the sketch Ai: usage and requests beside the prompts while they fit */
    .tb-ai {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 22.5rem), 1fr));
      align-items: start;
      gap: var(--tb-space-4);
    }

    .tb-ai__stack {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
      min-width: 0;
    }

    .tb-ai__usage {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--tb-space-2);
    }

    /* our decision: the share of the limit is the card's headline number, M3 headline small */
    .tb-ai__percent {
      font: var(--tb-type-headline-s);
    }

    /* a 6 dp track, one segment per feature (the sketch's bar) */
    .tb-ai__bar {
      display: flex;
      height: 6px;
      overflow: hidden;
      border-radius: 3px;
      background: var(--p-md-outline-variant);

      > i {
        display: block;
      }
    }

    .tb-ai__legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2) var(--tb-space-4);
      padding: 0;
      list-style: none;
      font: var(--tb-type-body-m);

      > li {
        display: inline-flex;
        align-items: center;
        gap: var(--tb-space-2);
      }

      i {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 5px;
      }
    }

    .tb-ai__error {
      display: block;
      margin-top: var(--tb-space-1);
      overflow-wrap: anywhere;
    }
  `,
})
export class AiSettingsPanel implements OnInit {
  protected readonly t = T.usage;
  private readonly api = inject(AiApi);
  protected readonly setup = inject(AiSetup);
  private readonly snackbar = inject(Snackbar);

  protected readonly featureIcons = FEATURE_ICONS;
  protected readonly when = dayTime;
  protected readonly numberLocale = locale();
  protected readonly report = signal<UsageReport | null>(null);
  /** Requests shown in the log: the first page of the report and those added by «Показать ещё». */
  protected readonly recent = signal<AiRequestLog[]>([]);
  protected readonly moreRecent = signal(false);
  protected readonly loadingMore = signal(false);
  /** What the limit field holds while it is edited; saved on leaving it or Enter. */
  protected readonly limitDraft = signal<number | null>(null);
  /** The limit in force: the settings' once loaded, else the report's. */
  protected readonly limit = computed(
    () => this.setup.settings()?.monthlyTokenLimit ?? this.report()?.monthlyTokenLimit ?? 0,
  );

  /** The models of the month as segments of the bar, in the order of the connections. */
  protected readonly parts = computed<UsagePart[]>(() => {
    const report = this.report();
    if (report === null) {
      return [];
    }
    return report.models
      .map((model, index) => ({ model, index, tokens: model.inputTokens + model.outputTokens }))
      .filter((entry) => entry.tokens > 0)
      .map((entry, index) => ({
        key: entry.model.modelId ?? `removed-${String(entry.index)}`,
        label: entry.model.removed ? this.t.removedModel(entry.model.label) : entry.model.label,
        percent: this.share(entry.tokens, report.usedTokens),
        color: SEGMENT_COLORS[index % SEGMENT_COLORS.length] ?? 'var(--p-md-primary)',
      }));
  });

  ngOnInit(): void {
    this.setup.load();
    this.api.usage().subscribe((report) => {
      this.report.set(report);
      this.recent.set(report.recent);
      this.moreRecent.set(report.moreRecent);
    });
  }

  protected showMore(month: string): void {
    if (this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.api.requests(month, this.recent().length).subscribe({
      next: (page) => {
        this.loadingMore.set(false);
        this.recent.update((recent) => [...recent, ...page.items]);
        this.moreRecent.set(page.hasMore);
      },
      error: () => {
        this.loadingMore.set(false);
      },
    });
  }

  /** The limit field on leaving it or Enter: saved when it changed; an emptied field shows the saved one. */
  protected saveLimit(): void {
    const draft = this.limitDraft();
    this.limitDraft.set(null);
    const saved = this.setup.settings()?.monthlyTokenLimit;
    if (draft === null || saved === undefined || draft === saved) {
      return;
    }
    this.setup.saveLimit(Math.max(0, Math.round(draft))).subscribe(() => {
      this.snackbar.success(this.t.limitSaved);
    });
  }

  /** «Черновик задания»: a request is one draft. */
  protected featureLabel(feature: AiFeature): string {
    return T.systemPrompts.features[feature];
  }

  protected statusOf(row: AiRequestLog): { label: string; severity: TagSeverity } {
    return STATUS_LABELS[row.status];
  }

  protected percent(tokens: number): number {
    const limit = this.limit();
    return limit === 0 ? 0 : Math.min(100, Math.round((tokens / limit) * 100));
  }

  /** A model's share of the limit, or of the month's tokens when there is no limit. */
  private share(tokens: number, used: number): number {
    if (this.limit() > 0) {
      return this.percent(tokens);
    }
    return used === 0 ? 0 : Math.round((tokens / used) * 100);
  }

  /** «ноябрь»: the month of the report in words. */
  protected monthName(yearMonth: string): string {
    const [year = 0, month = 1] = yearMonth.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(locale(), { month: 'long' });
  }

  /** «1 декабря»: the day after the report's month, when the limit starts over. */
  protected resetDay(yearMonth: string): string {
    const [year = 0, month = 1] = yearMonth.split('-').map(Number);
    return new Date(year, month, 1).toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
  }
}
