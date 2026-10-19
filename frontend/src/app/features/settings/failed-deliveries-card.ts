import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { EmptyState } from '@shared/ui/empty-state';
import { RowType } from '@shared/ui/row-type.directive';
import { SHARED_T } from '@shared/i18n/texts';
import { FailedDelivery, MessengerType } from './data-access/settings.models';
import { T } from './i18n/texts';

const MESSENGERS: { readonly type: MessengerType; readonly name: string }[] = [
  { type: 'TELEGRAM', name: 'Telegram' },
  { type: 'VK', name: SHARED_T.messengers.VK },
  { type: 'MAX', name: 'MAX' },
];

/** The notifications that did not reach a messenger (category «Мессенджеры»; its badge counts them). */
@Component({
  selector: 'tb-failed-deliveries-card',
  imports: [Card, DatePipe, EmptyState, TableModule, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="deliveries" [header]="t.deliveries">
      @if (deliveries().length === 0) {
        <tb-empty-state [compact]="true" icon="tb-i-check_circle" [title]="t.allDelivered" />
      } @else {
        <p-table [value]="deliveries()" styleClass="tb-cards">
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
    </p-card>
  `,
  styles: `
    .tb-error-cell {
      overflow-wrap: anywhere;
    }
  `,
})
export class FailedDeliveriesCard {
  protected readonly t = T.page;

  readonly deliveries = input.required<FailedDelivery[]>();

  protected messengerName(row: FailedDelivery): string {
    return MESSENGERS.find((messenger) => messenger.type === row.channel)?.name ?? row.channel;
  }
}
