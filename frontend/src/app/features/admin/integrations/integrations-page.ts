import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { describeError } from '@core/http/error-messages';
import { RowType } from '@shared/ui/row-type.directive';
import { AdminApi } from '../data-access/admin-api';
import { AiStatus, AiUsage, IntegrationStatus } from '../data-access/admin.models';
import { INTEGRATION_TAGS } from '../admin-labels';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { CountPipe } from '@shared/text/plural';

/** Administrator: connection to the messengers, the AI provider and Google; the log of AI requests. */
@Component({
  selector: 'tb-integrations-page',
  imports: [
    CountPipe,
    DatePipe,
    DecimalPipe,
    Button,
    Card,
    Message,
    TableModule,
    Tag,
    RowType,
    PageHeader,
    HelpButton,
    EmptyState,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Интеграции">
      <tb-help-button help topic="admin/diagnostics" />
    </tb-page-header>
    <div class="tb-stack">
      <p-card>
        <ng-template #title>
          <div class="tb-card-title">
            <span class="tb-card-title__text">Проверка связи</span>
            <div class="tb-card-title__actions">
              <p-button
                label="Проверить"
                severity="secondary"
                icon="pi pi-refresh"
                [loading]="checking()"
                (onClick)="check()"
              />
            </div>
          </div>
        </ng-template>
        <p class="tb-muted">
          Портал обращается к каждому сервису так же, как при работе (через настроенный прокси). ИИ
          проверяется без расхода токенов.
        </p>
        @if (error(); as message) {
          <p-message severity="error">{{ message }}</p-message>
        }
        @if (checks(); as checks) {
          <ul class="tb-checks">
            @for (check of checks; track check.name) {
              <li>
                <strong>{{ check.name }}</strong>
                <p-tag [value]="tags[check.state].label" [severity]="tags[check.state].severity" />
                <span class="tb-checks__detail">{{ check.detail }}</span>
                @if (check.state !== 'NOT_CONFIGURED') {
                  <small class="tb-muted">{{ check.millis }}&nbsp;мс</small>
                }
              </li>
            }
          </ul>
        }
      </p-card>

      <p-card header="Запросы к ИИ">
        <tb-load-state [state]="aiState" what="запросы к ИИ" (retry)="loadAi()">
          @if (ai(); as ai) {
            @if (ai.enabled) {
              <p>
                {{ ai.provider }} · {{ ai.model }} · в этом месяце
                {{ ai.usedThisMonth | count: 'токен' : 'токена' : 'токенов' }}
                @if (ai.monthlyTokenLimit > 0) {
                  из {{ ai.monthlyTokenLimit | number }}
                }
              </p>
            } @else {
              <p class="tb-muted">ИИ-помощник не настроен (TEACHERBOX_AI_PROVIDER).</p>
            }
          }
          @if (usage(); as usage) {
            @if (usage.recent.length === 0) {
              <tb-empty-state icon="pi-sparkles" title="В этом месяце запросов не было" />
            } @else {
              <p-table [value]="usage.recent" styleClass="tb-cards">
                <ng-template #header>
                  <tr>
                    <th>Когда</th>
                    <th>Что</th>
                    <th>Итог</th>
                    <th class="tb-num">Токены</th>
                    <th>Время</th>
                  </tr>
                </ng-template>
                <ng-template #body let-request [tbRowType]="usage.recent">
                  <tr>
                    <td data-label="Когда">{{ request.createdAt | date: 'dd.MM HH:mm' }}</td>
                    <td data-label="Что">{{ request.feature }}</td>
                    <td data-label="Итог">
                      <p-tag
                        [value]="requestStatus(request.status).label"
                        [severity]="requestStatus(request.status).severity"
                      />
                      @if (request.error !== null) {
                        <small class="tb-negative">{{ request.error }}</small>
                      }
                    </td>
                    <td data-label="Токены" class="tb-num">
                      {{ request.inputTokens | number }} / {{ request.outputTokens | number }}
                    </td>
                    <td data-label="Время">{{ request.durationMs / 1000 | number: '1.1-1' }} с</td>
                  </tr>
                </ng-template>
              </p-table>
            }
          }
        </tb-load-state>
      </p-card>
    </div>
  `,
  styles: `
    /* a check: the service and its state on the first line, the details and the time under them */
    .tb-checks {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
      margin: var(--tb-space-4) 0 0;
      padding: 0;
      list-style: none;

      li {
        display: grid;
        grid-template-areas: 'name state' 'detail time';
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--tb-space-1) var(--tb-space-3);
      }

      strong {
        grid-area: name;
      }

      p-tag {
        grid-area: state;
        justify-self: end;
      }

      small {
        grid-area: time;
        align-self: start;
        white-space: nowrap;
      }
    }

    .tb-checks__detail {
      grid-area: detail;
      overflow-wrap: anywhere;
    }
  `,
})
export class IntegrationsPage implements OnInit {
  /** The result of a request to the AI as a tag, not the raw name of the status. */
  protected requestStatus(status: string): {
    label: string;
    severity: 'success' | 'danger' | 'warn' | 'secondary';
  } {
    switch (status) {
      case 'SUCCEEDED':
        return { label: 'Готово', severity: 'success' };
      case 'FAILED':
        return { label: 'Ошибка', severity: 'danger' };
      case 'REFUSED':
        return { label: 'Отказ модели', severity: 'warn' };
      default:
        return { label: status, severity: 'secondary' };
    }
  }

  private readonly api = inject(AdminApi);

  protected readonly tags = INTEGRATION_TAGS;
  protected readonly checks = signal<IntegrationStatus[] | null>(null);
  protected readonly checking = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly ai = signal<AiStatus | null>(null);
  protected readonly usage = signal<AiUsage | null>(null);

  protected readonly aiState = new LoadState();

  ngOnInit(): void {
    this.check();
    this.loadAi();
  }

  protected loadAi(): void {
    forkJoin({ status: this.api.aiStatus(), usage: this.api.aiUsage() })
      .pipe(this.aiState.track())
      .subscribe(({ status, usage }) => {
        this.ai.set(status);
        this.usage.set(usage);
      });
  }

  check(): void {
    this.checking.set(true);
    this.error.set(null);
    this.api.checkIntegrations().subscribe({
      next: (checks) => {
        this.checking.set(false);
        this.checks.set(checks);
      },
      error: (error: unknown) => {
        this.checking.set(false);
        this.error.set(describeError(error, 'Не удалось выполнить проверку'));
      },
    });
  }
}
