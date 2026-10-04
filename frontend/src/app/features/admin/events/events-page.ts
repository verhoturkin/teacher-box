import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { RowType } from '@shared/ui/row-type.directive';
import { AdminApi } from '../data-access/admin-api';
import { EventPublication, FailedDelivery } from '../data-access/admin.models';
import { shortLogger } from '../admin-labels';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Snackbar } from '@core/snackbar/snackbar';

/** Administrator: events not processed yet and failed deliveries to messengers, with a retry. */
@Component({
  selector: 'tb-events-page',
  imports: [
    DatePipe,
    Button,
    Card,
    TableModule,
    RowType,
    PageHeader,
    HelpButton,
    EmptyState,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="События">
      <tb-help-button help topic="admin/diagnostics" />
    </tb-page-header>
    <div class="tb-stack">
      <p-card header="Необработанные события">
        <p class="tb-muted">
          Действия, которые портал ещё не довёл до конца: например, уведомление не создано из-за
          сбоя. Обычно они повторяются сами после перезапуска; здесь их можно отправить повторно
          сразу.
        </p>
        <tb-load-state [state]="eventsState" what="события" (retry)="loadEvents()">
          @if (events().length === 0) {
            <tb-empty-state icon="pi-check-circle" title="Всё обработано." />
          } @else {
            <div class="tb-actions">
              <p-button
                label="Повторить все"
                icon="pi pi-replay"
                severity="secondary"
                (onClick)="resubmit([])"
              />
            </div>
            <p-table [value]="events()" styleClass="tb-cards p-datatable-sm">
              <ng-template #header>
                <tr>
                  <th>Когда</th>
                  <th>Событие</th>
                  <th>Обработчик</th>
                  <th>Попыток</th>
                  <th></th>
                </tr>
              </ng-template>
              <ng-template #body let-event [tbRowType]="events()">
                <tr>
                  <td data-label="Когда">{{ event.publishedAt | date: 'dd.MM HH:mm:ss' }}</td>
                  <td data-label="Событие">{{ event.eventType }}</td>
                  <td data-label="Обработчик" class="tb-mono" [title]="event.listener">
                    {{ short(event.listener) }}
                  </td>
                  <td data-label="Попыток">{{ event.attempts }}</td>
                  <td class="tb-row-actions">
                    <p-button label="Повторить" [text]="true" (onClick)="resubmit([event.id])" />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          }
        </tb-load-state>
      </p-card>

      <p-card header="Неудачные доставки в мессенджеры">
        <tb-load-state [state]="deliveriesState" what="доставки" (retry)="loadDeliveries()">
          @if (deliveries().length === 0) {
            <tb-empty-state icon="pi-check-circle" title="Все сообщения доставлены." />
          } @else {
            <div class="tb-actions">
              <p-button
                label="Отправить все повторно"
                icon="pi pi-replay"
                severity="secondary"
                (onClick)="retry([])"
              />
            </div>
            <p-table [value]="deliveries()" styleClass="tb-cards p-datatable-sm">
              <ng-template #header>
                <tr>
                  <th>Когда</th>
                  <th>Мессенджер</th>
                  <th>Получатель</th>
                  <th>Ошибка</th>
                  <th></th>
                </tr>
              </ng-template>
              <ng-template #body let-delivery [tbRowType]="deliveries()">
                <tr>
                  <td data-label="Когда">{{ delivery.createdAt | date: 'dd.MM HH:mm' }}</td>
                  <td data-label="Мессенджер">{{ delivery.channel }}</td>
                  <td data-label="Получатель" class="tb-mono">{{ delivery.recipientId }}</td>
                  <td data-label="Ошибка" class="tb-error-cell tb-cell-wide">
                    {{ delivery.error ?? '—' }}
                  </td>
                  <td class="tb-row-actions">
                    <p-button label="Повторить" [text]="true" (onClick)="retry([delivery.id])" />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          }
        </tb-load-state>
      </p-card>
    </div>
  `,
  styles: `
    .tb-mono {
      font-family: monospace;
      font-size: 0.85rem;
      overflow-wrap: anywhere;
    }

    .tb-error-cell {
      overflow-wrap: anywhere;
    }

    .tb-row-actions {
      text-align: right;
    }
  `,
})
export class EventsPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly events = signal<EventPublication[]>([]);
  protected readonly deliveries = signal<FailedDelivery[]>([]);
  protected readonly eventsState = new LoadState();
  protected readonly deliveriesState = new LoadState();

  ngOnInit(): void {
    this.loadEvents();
    this.loadDeliveries();
  }

  protected short(listener: string): string {
    return shortLogger(listener);
  }

  resubmit(ids: string[]): void {
    this.api.resubmitEvents(ids).subscribe((count) => {
      this.snackbar.success(`Отправлено повторно событий: ${String(count)}`);
      this.loadEvents();
    });
  }

  retry(ids: string[]): void {
    this.api.retryDeliveries(ids).subscribe((count) => {
      this.snackbar.success(`Отправлено повторно сообщений: ${String(count)}`);
      this.loadDeliveries();
    });
  }

  protected loadEvents(): void {
    this.api
      .events()
      .pipe(this.eventsState.track())
      .subscribe((events) => {
        this.events.set(events);
      });
  }

  protected loadDeliveries(): void {
    this.api
      .failedDeliveries()
      .pipe(this.deliveriesState.track())
      .subscribe((deliveries) => {
        this.deliveries.set(deliveries);
      });
  }
}
