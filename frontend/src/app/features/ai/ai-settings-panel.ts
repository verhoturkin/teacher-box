import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { locale } from '@core/i18n/language';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { AiApi } from './data-access/ai-api';
import {
  AiFeature,
  AiRequestLog,
  AiRequestStatus,
  AiStatus,
  UsageReport,
} from './data-access/ai.models';
import { dayTime } from '@shared/dates/iso-date';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from './i18n/texts';
import { PromptLibraryCard } from './prompt-library-card';
import { SystemPromptsCard } from './system-prompts-card';

export const FEATURE_LABELS: Record<AiFeature, string> = T.features;

/** The icon of a request in the log: a homework draft or a review draft. */
const FEATURE_ICONS: Record<AiFeature, string> = {
  HOMEWORK_DRAFT: 'tb-i tb-i-assignment',
  REVIEW_DRAFT: 'tb-i tb-i-rate_review',
};

type TagSeverity = 'success' | 'danger' | 'secondary';

const STATUS_LABELS: Record<AiRequestStatus, { label: string; severity: TagSeverity }> = {
  SUCCEEDED: { label: T.statuses.SUCCEEDED, severity: 'success' },
  FAILED: { label: T.statuses.FAILED, severity: 'danger' },
  REFUSED: { label: T.statuses.REFUSED, severity: 'secondary' },
};

/** The bar's segments: the feature that used more takes the primary colour, the next its light pair. */
const SEGMENT_COLORS = ['var(--p-md-primary)', 'var(--p-md-inverse-primary)'];

interface UsagePart {
  readonly feature: AiFeature;
  readonly label: string;
  readonly percent: number;
  readonly color: string;
}

/**
 * The settings category «ИИ-помощник» (sketch Ai): the model with the month's usage by feature, the log
 * of recent requests, the library of prompts (the editor's «Промты» menu leads here) and the system prompts.
 */
@Component({
  selector: 'tb-ai-settings-panel',
  imports: [DecimalPipe, Button, Card, Tag, EmptyState, PromptLibraryCard, SystemPromptsCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status(); as status) {
      @if (!status.enabled) {
        <p-card styleClass="tb-section-card">
          <tb-empty-state
            icon="tb-i-auto_awesome"
            [title]="t.notConfigured"
            [hint]="t.notConfiguredHint"
          />
        </p-card>
      } @else {
        <div class="tb-ai">
          <div class="tb-ai__stack">
            <p-card [header]="t.modelAndUsage" styleClass="tb-section-card tb-section-card--flow">
              <ul class="tb-list">
                <li>
                  <span class="tb-list__lead" aria-hidden="true"
                    ><i class="tb-i tb-i-auto_awesome"></i
                  ></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ status.model }}</span>
                    <span class="tb-list__supporting">{{ t.byAdmin }}</span>
                  </div>
                  <div class="tb-list__trail">
                    <p-tag [value]="t.working" severity="success" />
                  </div>
                </li>
              </ul>
              @if (report(); as report) {
                @if (report.monthlyTokenLimit > 0) {
                  <p class="tb-ai__usage">
                    <strong class="tb-ai__percent">{{ percent(report.usedTokens) }} %</strong>
                    <span class="tb-muted">{{
                      t.ofMonthLimit(
                        (report.usedTokens | number) ?? '',
                        (report.monthlyTokenLimit | number) ?? '',
                        resetDay(report.month)
                      )
                    }}</span>
                  </p>
                  <div class="tb-ai__bar" role="img" [attr.aria-label]="t.used">
                    @for (part of parts(report); track part.feature) {
                      <i [style.width.%]="part.percent" [style.background]="part.color"></i>
                    }
                  </div>
                  <ul class="tb-ai__legend">
                    @for (part of parts(report); track part.feature) {
                      <li>
                        <i [style.background]="part.color"></i>{{ part.label }} · {{ part.percent }}
                        %
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="tb-ai__usage">
                    <strong class="tb-ai__percent">{{ report.usedTokens | number }}</strong>
                    <span class="tb-muted">{{ t.tokensNoLimit }}</span>
                  </p>
                }
              }
            </p-card>
            @if (report(); as report) {
              <p-card
                [header]="t.recent(monthName(report.month))"
                styleClass="tb-section-card tb-section-card--flow"
              >
                @if (recent().length === 0) {
                  <tb-empty-state
                    [compact]="true"
                    icon="tb-i-auto_awesome"
                    [title]="t.noRequests"
                  />
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
                            {{ when(row.createdAt) }} ·
                            {{ t.inOut(row.inputTokens, row.outputTokens) }} ·
                            {{ t.seconds((row.durationMs / 1000 | number: '1.0-0') ?? '') }}
                          </span>
                          @if (row.error) {
                            <small class="tb-negative tb-ai__error">{{ row.error }}</small>
                          }
                        </div>
                        <div class="tb-list__trail">
                          <p-tag
                            [value]="statusOf(row).label"
                            [severity]="statusOf(row).severity"
                          />
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
      }
    }
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

  protected readonly featureIcons = FEATURE_ICONS;
  protected readonly when = dayTime;
  protected readonly status = signal<AiStatus | null>(null);
  protected readonly report = signal<UsageReport | null>(null);
  /** Requests shown in the log: the first page of the report and those added by «Показать ещё». */
  protected readonly recent = signal<AiRequestLog[]>([]);
  protected readonly moreRecent = signal(false);
  protected readonly loadingMore = signal(false);

  ngOnInit(): void {
    this.api.status().subscribe((status) => {
      this.status.set(status);
      if (status.enabled) {
        this.api.usage().subscribe((report) => {
          this.report.set(report);
          this.recent.set(report.recent);
          this.moreRecent.set(report.moreRecent);
        });
      }
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

  /** «Черновик задания»: a request is one draft, the usage legend counts them in the plural. */
  protected featureLabel(feature: AiFeature): string {
    return T.systemPrompts.features[feature];
  }

  protected statusOf(row: AiRequestLog): { label: string; severity: TagSeverity } {
    return STATUS_LABELS[row.status];
  }

  protected percent(tokens: number): number {
    const limit = this.report()?.monthlyTokenLimit ?? 0;
    return limit === 0 ? 0 : Math.min(100, Math.round((tokens / limit) * 100));
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

  /** The features of the month as segments of the bar, the biggest first, by the share of the limit. */
  protected parts(report: UsageReport): UsagePart[] {
    return report.features
      .map((feature) => ({
        feature: feature.feature,
        tokens: feature.inputTokens + feature.outputTokens,
      }))
      .filter((feature) => feature.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .map((feature, index) => ({
        feature: feature.feature,
        label: FEATURE_LABELS[feature.feature],
        percent: this.percent(feature.tokens),
        color: SEGMENT_COLORS[index % SEGMENT_COLORS.length] ?? 'var(--p-md-primary)',
      }));
  }
}
