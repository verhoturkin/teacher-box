import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';
import { Tag } from 'primeng/tag';
import { HelpButton } from '@features/help/parts';
import { AiApi } from './data-access/ai-api';
import {
  AiFeature,
  AiRequestLog,
  AiRequestStatus,
  AiStatus,
  UsageReport,
} from './data-access/ai.models';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { ProgressLabel } from '@shared/ui/progress-label.directive';
import { monthLabel } from '@shared/dates/iso-date';
import { T } from './i18n/texts';
import { PromptLibraryCard } from './prompt-library-card';
import { SystemPromptsCard } from './system-prompts-card';

export const FEATURE_LABELS: Record<AiFeature, string> = T.features;

/** The icon of a request in the log: a homework draft or a review draft. */
const FEATURE_ICONS: Record<AiFeature, string> = {
  HOMEWORK_DRAFT: 'pi pi-file-edit',
  REVIEW_DRAFT: 'pi pi-check-square',
};

/** Names of `TEACHERBOX_AI_PROVIDER` values. */
export const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
  'openai-compatible': T.openAiCompatible,
};

const STATUS_LABELS: Record<
  AiRequestStatus,
  { label: string; severity: 'success' | 'danger' | 'warn' }
> = {
  SUCCEEDED: { label: T.statuses.SUCCEEDED, severity: 'success' },
  FAILED: { label: T.statuses.FAILED, severity: 'danger' },
  REFUSED: { label: T.statuses.REFUSED, severity: 'warn' },
};

/** Teacher: whether the AI assistant is configured and how many tokens it used this month. */
@Component({
  selector: 'tb-ai-usage-page',
  imports: [
    HelpButton,
    DatePipe,
    DecimalPipe,
    Button,
    Card,
    ProgressBar,
    Tag,
    PageHeader,
    EmptyState,
    ProgressLabel,
    PromptLibraryCard,
    SystemPromptsCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="teacher/ai" />
    </tb-page-header>
    @if (status(); as status) {
      @if (!status.enabled) {
        <p-card>
          <tb-empty-state
            icon="pi-sparkles"
            [title]="t.notConfigured"
            [hint]="t.notConfiguredHint"
          />
        </p-card>
      } @else {
        <div class="tb-stack">
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">{{ t.model }}</span>
              <span class="tb-stat__value">{{ status.model }}</span>
              <small class="tb-muted">{{ providerName(status.provider) }}</small>
            </div>
          </p-card>
          @if (report(); as report) {
            <p-card [header]="t.usageIn(monthName(report.month))">
              <p>
                {{ t.tokens((report.usedTokens | number) ?? '') }}
                @if (report.monthlyTokenLimit > 0) {
                  {{ t.ofLimit((report.monthlyTokenLimit | number) ?? '') }}
                } @else {
                  {{ t.noLimit }}
                }
              </p>
              @if (report.monthlyTokenLimit > 0) {
                <p-progressbar
                  [value]="percent()"
                  [showValue]="false"
                  styleClass="tb-usage-bar"
                  [tbProgressLabel]="t.used"
                />
              }
              <ul class="tb-usage-features">
                @for (feature of report.features; track feature.feature) {
                  <li>
                    {{ featureLabels[feature.feature] }}: {{ t.requestCount(feature.requests) }},
                    {{ t.tokenCount(feature.inputTokens + feature.outputTokens) }}
                  </li>
                }
              </ul>
            </p-card>
            <p-card [header]="t.recent">
              @if (recent().length === 0) {
                <tb-empty-state [compact]="true" icon="pi-sparkles" [title]="t.noRequests" />
              } @else {
                <ul class="tb-list" [attr.aria-label]="t.recent">
                  @for (row of recent(); track $index) {
                    <li>
                      <span class="tb-list__lead" aria-hidden="true"
                        ><i [class]="featureIcons[row.feature]"></i
                      ></span>
                      <div class="tb-list__text">
                        <span class="tb-list__title tb-usage-title"
                          >{{ featureLabels[row.feature] }}
                          <p-tag
                            [value]="statusLabel(row).label"
                            [severity]="statusLabel(row).severity"
                        /></span>
                        <span class="tb-list__supporting">
                          {{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }} · {{ row.model }} ·
                          {{ t.seconds((row.durationMs / 1000 | number: '1.0-1') ?? '') }}
                        </span>
                        @if (row.error) {
                          <small class="tb-negative tb-usage-error">{{ row.error }}</small>
                        }
                      </div>
                      <div class="tb-list__trail tb-list__trail--amount">
                        <span class="tb-list__amount">{{
                          t.tokenCount(row.inputTokens + row.outputTokens)
                        }}</span>
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
          <tb-prompt-library-card />
          <tb-system-prompts-card />
        </div>
      }
    }
  `,
  styles: `
    .tb-usage-features {
      margin: var(--tb-space-4) 0 0;
      padding-left: var(--tb-space-5);
    }

    .tb-usage-title {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-usage-error {
      display: block;
      margin-top: var(--tb-space-1);
      overflow-wrap: anywhere;
    }
  `,
})
export class AiUsagePage implements OnInit {
  protected readonly t = T.usage;
  private readonly api = inject(AiApi);

  protected readonly featureLabels = FEATURE_LABELS;
  protected readonly featureIcons = FEATURE_ICONS;
  protected readonly monthName = monthLabel;
  protected readonly status = signal<AiStatus | null>(null);
  protected readonly report = signal<UsageReport | null>(null);
  /** Requests shown in the log: the first page of the report and those added by «Показать ещё». */
  protected readonly recent = signal<AiRequestLog[]>([]);
  protected readonly moreRecent = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly percent = computed(() => {
    const report = this.report();
    if (report === null || report.monthlyTokenLimit === 0) {
      return 0;
    }
    return Math.min(100, Math.round((report.usedTokens / report.monthlyTokenLimit) * 100));
  });

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

  protected providerName(provider: string | null): string {
    return provider === null ? '' : (PROVIDER_NAMES[provider] ?? provider);
  }

  protected statusLabel(row: AiRequestLog): {
    label: string;
    severity: 'success' | 'danger' | 'warn';
  } {
    return STATUS_LABELS[row.status];
  }
}
