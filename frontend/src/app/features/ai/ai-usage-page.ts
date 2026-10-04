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

export const FEATURE_LABELS: Record<AiFeature, string> = {
  HOMEWORK_DRAFT: 'Черновики заданий',
  REVIEW_DRAFT: 'Черновики проверки',
};

/** Names of `TEACHERBOX_AI_PROVIDER` values. */
export const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
  'openai-compatible': 'OpenAI-совместимый API',
};

const STATUS_LABELS: Record<
  AiRequestStatus,
  { label: string; severity: 'success' | 'danger' | 'warn' }
> = {
  SUCCEEDED: { label: 'Готово', severity: 'success' },
  FAILED: { label: 'Ошибка', severity: 'danger' },
  REFUSED: { label: 'Отказ модели', severity: 'warn' },
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="ИИ-помощник">
      <tb-help-button help topic="teacher/ai" />
    </tb-page-header>
    @if (status(); as status) {
      @if (!status.enabled) {
        <p-card>
          <tb-empty-state
            icon="pi-sparkles"
            title="ИИ-помощник не настроен"
            hint="Чтобы получать черновики заданий и проверок, укажите провайдера в настройках сервера: TEACHERBOX_AI_PROVIDER (anthropic, gemini или openai-compatible), TEACHERBOX_AI_API_KEY и при необходимости TEACHERBOX_AI_MODEL, TEACHERBOX_AI_BASE_URL, TEACHERBOX_AI_PROXY — и перезапустите портал."
          />
        </p-card>
      } @else {
        <div class="tb-stack">
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">Модель</span>
              <span class="tb-stat__value">{{ status.model }}</span>
              <small class="tb-muted">{{ providerName(status.provider) }}</small>
            </div>
          </p-card>
          @if (report(); as report) {
            <p-card [header]="'Использование за ' + report.month">
              <p>
                Токенов: {{ report.usedTokens | number }}
                @if (report.monthlyTokenLimit > 0) {
                  из {{ report.monthlyTokenLimit | number }}
                } @else {
                  (без лимита)
                }
              </p>
              @if (report.monthlyTokenLimit > 0) {
                <p-progressbar
                  [value]="percent()"
                  [showValue]="false"
                  styleClass="tb-usage-bar"
                  tbProgressLabel="Израсходовано токенов за месяц"
                />
              }
              <ul class="tb-usage-features">
                @for (feature of report.features; track feature.feature) {
                  <li>
                    {{ featureLabels[feature.feature] }}: {{ feature.requests }} запр.,
                    {{ feature.inputTokens + feature.outputTokens | number }} токенов
                  </li>
                }
              </ul>
            </p-card>
            <p-card header="Последние запросы">
              @if (report.recent.length === 0) {
                <tb-empty-state
                  [compact]="true"
                  icon="pi-sparkles"
                  title="Запросов в этом месяце не было"
                />
              } @else {
                <p-table [value]="report.recent" styleClass="tb-cards p-datatable-sm">
                  <ng-template #header>
                    <tr>
                      <th>Когда</th>
                      <th>Что</th>
                      <th>Результат</th>
                      <th>Токены</th>
                      <th>Время</th>
                    </tr>
                  </ng-template>
                  <ng-template #body [tbRowType]="report.recent" let-row>
                    <tr>
                      <td data-label="Когда">{{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }}</td>
                      <td data-label="Что">{{ featureLabels[row.feature] }}</td>
                      <td data-label="Результат">
                        <p-tag
                          [value]="statusLabel(row).label"
                          [severity]="statusLabel(row).severity"
                        />
                        @if (row.error) {
                          <small class="tb-muted tb-usage-error">{{ row.error }}</small>
                        }
                      </td>
                      <td data-label="Токены">{{ row.inputTokens + row.outputTokens | number }}</td>
                      <td data-label="Время">{{ row.durationMs / 1000 | number: '1.0-1' }} с</td>
                    </tr>
                  </ng-template>
                </p-table>
              }
            </p-card>
          }
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
  private readonly api = inject(AiApi);

  protected readonly featureLabels = FEATURE_LABELS;
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
