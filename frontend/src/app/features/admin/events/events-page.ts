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
import { Busy } from '@shared/ui/busy';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

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
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="admin/diagnostics" />
    </tb-page-header>
    <div class="tb-stack">
      <p-card>
        <ng-template #title>
          <div class="tb-card-title">
            <span class="tb-card-title__text">{{ t.pending }}</span>
            @if (events().length > 0) {
              <div class="tb-card-title__actions">
                <p-button
                  [label]="t.retryAll"
                  icon="pi pi-replay"
                  severity="secondary"
                  [loading]="busy.is('events')"
                  (onClick)="resubmit([])"
                />
              </div>
            }
          </div>
        </ng-template>
        <p class="tb-muted">{{ t.about }}</p>
        <tb-load-state [state]="eventsState" [what]="t.what" (retry)="loadEvents()">
          @if (events().length === 0) {
            <tb-empty-state icon="pi-check-circle" [title]="t.allDone" />
          } @else {
            <p-table [value]="events()" styleClass="tb-cards">
              <ng-template #header>
                <tr>
                  <th>{{ t.when }}</th>
                  <th>{{ t.event }}</th>
                  <th>{{ t.listener }}</th>
                  <th class="tb-num">{{ t.attempts }}</th>
                  <th></th>
                </tr>
              </ng-template>
              <ng-template #body let-event [tbRowType]="events()">
                <tr>
                  <td [attr.data-label]="t.when">
                    {{ event.publishedAt | date: 'dd.MM HH:mm:ss' }}
                  </td>
                  <td [attr.data-label]="t.event">{{ event.eventType }}</td>
                  <td [attr.data-label]="t.listener" class="tb-mono" [title]="event.listener">
                    {{ short(event.listener) }}
                  </td>
                  <td [attr.data-label]="t.attempts" class="tb-num">{{ event.attempts }}</td>
                  <td class="tb-row-actions">
                    <p-button
                      [label]="t.retry"
                      [text]="true"
                      [ariaLabel]="t.retryOf(event.eventType)"
                      [loading]="busy.is('event-' + event.id)"
                      (onClick)="resubmit([event.id])"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          }
        </tb-load-state>
      </p-card>

      <p-card>
        <ng-template #title>
          <div class="tb-card-title">
            <span class="tb-card-title__text">{{ t.deliveries }}</span>
            @if (deliveries().length > 0) {
              <div class="tb-card-title__actions">
                <p-button
                  [label]="t.resendAll"
                  icon="pi pi-replay"
                  severity="secondary"
                  [loading]="busy.is('deliveries')"
                  (onClick)="retry([])"
                />
              </div>
            }
          </div>
        </ng-template>
        <tb-load-state
          [state]="deliveriesState"
          [what]="t.whatDeliveries"
          (retry)="loadDeliveries()"
        >
          @if (deliveries().length === 0) {
            <tb-empty-state icon="pi-check-circle" [title]="t.allDelivered" />
          } @else {
            <p-table [value]="deliveries()" styleClass="tb-cards">
              <ng-template #header>
                <tr>
                  <th>{{ t.when }}</th>
                  <th>{{ t.messenger }}</th>
                  <th>{{ t.recipient }}</th>
                  <th>{{ t.error }}</th>
                  <th></th>
                </tr>
              </ng-template>
              <ng-template #body let-delivery [tbRowType]="deliveries()">
                <tr>
                  <td [attr.data-label]="t.when">{{ delivery.createdAt | date: 'dd.MM HH:mm' }}</td>
                  <td [attr.data-label]="t.messenger">{{ channelName(delivery.channel) }}</td>
                  <td [attr.data-label]="t.recipient" class="tb-mono">
                    {{ delivery.recipientId }}
                  </td>
                  <td [attr.data-label]="t.error" class="tb-error-cell tb-cell-wide">
                    {{ delivery.error ?? '—' }}
                  </td>
                  <td class="tb-row-actions">
                    <p-button
                      [label]="t.retry"
                      [text]="true"
                      [ariaLabel]="t.retryOf(delivery.channel + ', ' + delivery.recipientId)"
                      [loading]="busy.is('delivery-' + delivery.id)"
                      (onClick)="retry([delivery.id])"
                    />
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
      font-family: var(--tb-font-mono);
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
  protected readonly t = T.events;
  protected channelName(channel: string): string {
    const names: Record<string, string> = SHARED_T.messengers;
    return names[channel] ?? channel;
  }

  private readonly api = inject(AdminApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly events = signal<EventPublication[]>([]);
  protected readonly deliveries = signal<FailedDelivery[]>([]);
  protected readonly busy = new Busy();
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
    this.busy
      .guard(this.key('event', ids, 'events'), this.api.resubmitEvents(ids))
      .subscribe((count) => {
        this.snackbar.success(T.events.eventsResent(count));
        this.loadEvents();
      });
  }

  retry(ids: string[]): void {
    this.busy
      .guard(this.key('delivery', ids, 'deliveries'), this.api.retryDeliveries(ids))
      .subscribe((count) => {
        this.snackbar.success(T.events.messagesResent(count));
        this.loadDeliveries();
      });
  }

  /** The key of the button: a row by its id, «all» by the list. */
  private key(row: string, ids: string[], all: string): string {
    return ids.length === 1 ? `${row}-${ids[0] ?? ''}` : all;
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
