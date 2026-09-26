import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { RowType } from '@shared/ui/row-type.directive';
import { AdminApi } from '../data-access/admin-api';
import { EventPublication, FailedDelivery } from '../data-access/admin.models';
import { shortLogger } from '../admin-labels';

/** Administrator: events not processed yet and failed deliveries to messengers, with a retry. */
@Component({
  selector: 'tb-events-page',
  imports: [DatePipe, Button, Card, TableModule, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">События</h1>
    <div class="tb-stack">
      <p-card header="Необработанные события">
        <p class="tb-muted">
          Действия, которые портал ещё не довёл до конца: например, уведомление не создано из-за сбоя. Обычно они
          повторяются сами после перезапуска; здесь их можно отправить повторно сразу.
        </p>
        @if (events().length === 0) {
          <p class="tb-muted">Всё обработано.</p>
        } @else {
          <div class="tb-actions">
            <p-button label="Повторить все" icon="pi pi-replay" [outlined]="true" (onClick)="resubmit([])" />
          </div>
          <p-table [value]="events()" styleClass="p-datatable-sm">
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
                <td>{{ event.publishedAt | date: 'dd.MM HH:mm:ss' }}</td>
                <td>{{ event.eventType }}</td>
                <td class="tb-mono" [title]="event.listener">{{ short(event.listener) }}</td>
                <td>{{ event.attempts }}</td>
                <td class="tb-row-actions">
                  <p-button label="Повторить" size="small" [text]="true" (onClick)="resubmit([event.id])" />
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>

      <p-card header="Неудачные доставки в мессенджеры">
        @if (deliveries().length === 0) {
          <p class="tb-muted">Все сообщения доставлены.</p>
        } @else {
          <div class="tb-actions">
            <p-button label="Отправить все повторно" icon="pi pi-replay" [outlined]="true" (onClick)="retry([])" />
          </div>
          <p-table [value]="deliveries()" styleClass="p-datatable-sm">
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
                <td>{{ delivery.createdAt | date: 'dd.MM HH:mm' }}</td>
                <td>{{ delivery.channel }}</td>
                <td class="tb-mono">{{ delivery.recipientId }}</td>
                <td class="tb-error-cell">{{ delivery.error ?? '—' }}</td>
                <td class="tb-row-actions">
                  <p-button label="Повторить" size="small" [text]="true" (onClick)="retry([delivery.id])" />
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
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
  private readonly messages = inject(MessageService);

  protected readonly events = signal<EventPublication[]>([]);
  protected readonly deliveries = signal<FailedDelivery[]>([]);

  ngOnInit(): void {
    this.loadEvents();
    this.loadDeliveries();
  }

  protected short(listener: string): string {
    return shortLogger(listener);
  }

  resubmit(ids: string[]): void {
    this.api.resubmitEvents(ids).subscribe((count) => {
      this.messages.add({ severity: 'success', summary: 'Отправлено повторно', detail: `Событий: ${String(count)}` });
      this.loadEvents();
    });
  }

  retry(ids: string[]): void {
    this.api.retryDeliveries(ids).subscribe((count) => {
      this.messages.add({ severity: 'success', summary: 'Отправлено повторно', detail: `Сообщений: ${String(count)}` });
      this.loadDeliveries();
    });
  }

  private loadEvents(): void {
    this.api.events().subscribe((events) => {
      this.events.set(events);
    });
  }

  private loadDeliveries(): void {
    this.api.failedDeliveries().subscribe((deliveries) => {
      this.deliveries.set(deliveries);
    });
  }
}
