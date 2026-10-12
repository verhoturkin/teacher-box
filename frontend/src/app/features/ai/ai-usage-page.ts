import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Card } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { HelpButton } from '@features/help/parts';
import { RowType } from '@shared/ui/row-type.directive';
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

export const FEATURE_LABELS: Record<AiFeature, string> = T.features;

/** Names of `TEACHERBOX_AI_PROVIDER` values. */
export const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
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
    Card,
    ProgressBar,
    TableModule,
    Tag,
    RowType,
    PageHeader,
    EmptyState,
    ProgressLabel,
    PromptLibraryCard,
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
              @if (report.recent.length === 0) {
                <tb-empty-state [compact]="true" icon="pi-sparkles" [title]="t.noRequests" />
              } @else {
                <p-table [value]="report.recent" styleClass="tb-cards">
                  <ng-template #header>
                    <tr>
                      <th>{{ t.when }}</th>
                      <th>{{ t.what }}</th>
                      <th>{{ t.result }}</th>
                      <th class="tb-num">{{ t.tokensColumn }}</th>
                      <th>{{ t.time }}</th>
                    </tr>
                  </ng-template>
                  <ng-template #body [tbRowType]="report.recent" let-row>
                    <tr>
                      <td [attr.data-label]="t.when">
                        {{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }}
                      </td>
                      <td [attr.data-label]="t.what">{{ featureLabels[row.feature] }}</td>
                      <td [attr.data-label]="t.result">
                        <p-tag
                          [value]="statusLabel(row).label"
                          [severity]="statusLabel(row).severity"
                        />
                        @if (row.error) {
                          <small class="tb-muted tb-usage-error">{{ row.error }}</small>
                        }
                      </td>
                      <td [attr.data-label]="t.tokensColumn" class="tb-num">
                        {{ row.inputTokens + row.outputTokens | number }}
                      </td>
                      <td [attr.data-label]="t.time">
                        {{ t.seconds((row.durationMs / 1000 | number: '1.0-1') ?? '') }}
                      </td>
                    </tr>
                  </ng-template>
                </p-table>
              }
            </p-card>
          }
          <tb-prompt-library-card />
        </div>
      }
    }
  `,
  styles: `
    .tb-usage-features {
      margin: var(--tb-space-4) 0 0;
      padding-left: var(--tb-space-5);
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
  protected readonly monthName = monthLabel;
  protected readonly status = signal<AiStatus | null>(null);
  protected readonly report = signal<UsageReport | null>(null);
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
        });
      }
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
