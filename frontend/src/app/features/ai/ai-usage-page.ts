import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { ProgressBar } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { RowType } from '@shared/ui/row-type.directive';
import { AiApi } from './data-access/ai-api';
import { AiFeature, AiRequestLog, AiRequestStatus, AiStatus, UsageReport } from './data-access/ai.models';

export const FEATURE_LABELS: Record<AiFeature, string> = {
  HOMEWORK_DRAFT: 'Черновики заданий',
  REVIEW_DRAFT: 'Черновики проверки',
};

const STATUS_LABELS: Record<AiRequestStatus, { label: string; severity: 'success' | 'danger' | 'warn' }> = {
  SUCCEEDED: { label: 'Готово', severity: 'success' },
  FAILED: { label: 'Ошибка', severity: 'danger' },
  REFUSED: { label: 'Отказ модели', severity: 'warn' },
};

/** Teacher: whether the AI assistant is configured and how many tokens it used this month. */
@Component({
  selector: 'tb-ai-usage-page',
  imports: [DatePipe, DecimalPipe, Card, ProgressBar, TableModule, Tag, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">ИИ-помощник</h1>
    @if (status(); as status) {
      @if (!status.enabled) {
        <p-card>
          <p>ИИ-помощник не настроен.</p>
          <p class="tb-muted">
            Чтобы получать черновики заданий и проверок, укажите провайдера в настройках сервера:
            TEACHERBOX_AI_PROVIDER (anthropic или openai-compatible), TEACHERBOX_AI_API_KEY и при необходимости
            TEACHERBOX_AI_MODEL, TEACHERBOX_AI_BASE_URL — и перезапустите портал.
          </p>
        </p-card>
      } @else {
        <div class="tb-stack">
          <p-card>
            <div class="tb-stat">
              <span class="tb-muted">Модель</span>
              <span class="tb-stat__value">{{ status.model }}</span>
              <small class="tb-muted">{{ status.provider }}</small>
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
                <p-progressbar [value]="percent()" [showValue]="false" styleClass="tb-usage-bar" />
              }
              <ul class="tb-usage-features">
                @for (feature of report.features; track feature.feature) {
                  <li>{{ featureLabels[feature.feature] }}: {{ feature.requests }} запр.,
                    {{ feature.inputTokens + feature.outputTokens | number }} токенов</li>
                }
              </ul>
            </p-card>
            <p-card header="Последние запросы">
              @if (report.recent.length === 0) {
                <p class="tb-muted">Запросов в этом месяце не было.</p>
              } @else {
                <p-table [value]="report.recent" styleClass="p-datatable-sm">
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
                      <td>{{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }}</td>
                      <td>{{ featureLabels[row.feature] }}</td>
                      <td>
                        <p-tag [value]="statusLabel(row).label" [severity]="statusLabel(row).severity" />
                        @if (row.error) {
                          <small class="tb-muted tb-usage-error">{{ row.error }}</small>
                        }
                      </td>
                      <td>{{ row.inputTokens + row.outputTokens | number }}</td>
                      <td>{{ row.durationMs / 1000 | number: '1.0-1' }} с</td>
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
      margin: 1rem 0 0;
      padding-left: 1.25rem;
    }

    .tb-usage-error {
      display: block;
      margin-top: 0.25rem;
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

  protected statusLabel(row: AiRequestLog): { label: string; severity: 'success' | 'danger' | 'warn' } {
    return STATUS_LABELS[row.status];
  }
}
