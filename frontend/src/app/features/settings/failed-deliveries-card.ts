import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { RowType } from '@shared/ui/row-type.directive';
import { SHARED_T } from '@shared/i18n/texts';
import { FailedDelivery, MessengerType } from './data-access/settings.models';
import { T } from './i18n/texts';

const MESSENGERS: { readonly type: MessengerType; readonly name: string }[] = [
  { type: 'TELEGRAM', name: 'Telegram' },
  { type: 'VK', name: SHARED_T.messengers.VK },
  { type: 'MAX', name: 'MAX' },
];

/**
 * The notifications that did not reach a messenger (category «Мессенджеры»; its badge counts them): an
 * error alert with the latest one (sketch Messengers), «Показать» unfolds them all.
 */
@Component({
  selector: 'tb-failed-deliveries-card',
  imports: [Button, DatePipe, Message, TableModule, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    @if (deliveries()[0]; as last) {
      <p-message id="deliveries" severity="error" icon="tb-i tb-i-error" role="alert">
        <div class="tb-deliveries__alert">
          <span class="tb-deliveries__text">
            <strong>{{ t.notDeliveredTitle(deliveries().length) }}</strong>
            {{ last.recipientName ?? t.you }} · {{ messengerName(last) }} ·
            {{ last.createdAt | date: 'dd.MM HH:mm' }}
          </span>
          <p-button
            [label]="open() ? t.hideDeliveries : t.showDeliveries"
            severity="danger"
            [text]="true"
            aria-controls="tb-deliveries-list"
            [attr.aria-expanded]="open()"
            (onClick)="open.set(!open())"
          />
        </div>
      </p-message>
      @if (open()) {
        <p-table
          id="tb-deliveries-list"
          [value]="deliveries()"
          styleClass="tb-cards tb-deliveries__table"
        >
          <ng-template #header>
            <tr>
              <th>{{ t.when }}</th>
              <th>{{ t.to }}</th>
              <th>{{ t.where }}</th>
              <th>{{ t.error }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-row [tbRowType]="deliveries()">
            <tr>
              <td [attr.data-label]="t.when">{{ row.createdAt | date: 'dd.MM.yyyy HH:mm' }}</td>
              <td [attr.data-label]="t.to">{{ row.recipientName ?? t.you }}</td>
              <td [attr.data-label]="t.where">{{ messengerName(row) }}</td>
              <td [attr.data-label]="t.error" class="tb-error-cell tb-cell-wide">
                {{ row.error ?? '—' }}
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    }
  `,
  styles: `
    .tb-deliveries__alert {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-deliveries__text {
      flex: 1;
      min-width: 12rem;
    }

    :host ::ng-deep .tb-deliveries__table {
      margin-top: var(--tb-space-3);
    }

    .tb-error-cell {
      overflow-wrap: anywhere;
    }
  `,
})
export class FailedDeliveriesCard {
  protected readonly t = T.page;

  /** The latest first. */
  readonly deliveries = input.required<FailedDelivery[]>();

  protected readonly open = signal(false);

  protected messengerName(row: FailedDelivery): string {
    return MESSENGERS.find((messenger) => messenger.type === row.channel)?.name ?? row.channel;
  }
}
