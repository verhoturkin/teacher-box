import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Avatar } from '@shared/ui/avatar';
import { dayTime } from '@shared/dates/iso-date';
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
  imports: [Avatar, Button, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  template: `
    @if (deliveries()[0]; as last) {
      <p-message id="deliveries" severity="error" icon="tb-i tb-i-error" role="alert">
        <div class="tb-deliveries__alert">
          <span class="tb-deliveries__text">
            <strong>{{ t.notDeliveredTitle(deliveries().length) }}</strong>
            @if (!open()) {
              {{ last.recipientName ?? t.you }} · {{ messengerName(last) }} ·
              {{ when(last.createdAt) }}
            }
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
        <ul
          id="tb-deliveries-list"
          class="tb-list tb-deliveries__list"
          [attr.aria-label]="t.notDeliveredTitle(deliveries().length)"
        >
          @for (row of deliveries(); track $index) {
            <li>
              <span class="tb-list__lead" aria-hidden="true">
                <tb-avatar [name]="row.recipientName ?? t.you" size="2rem" />
              </span>
              <div class="tb-list__text">
                <span class="tb-list__title"
                  >{{ row.recipientName ?? t.you }} · {{ messengerName(row) }}</span
                >
                <span class="tb-list__supporting tb-deliveries__reason"
                  >{{ when(row.createdAt, true) }}{{ reason(row) }}</span
                >
              </div>
            </li>
          }
        </ul>
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

    .tb-deliveries__list {
      margin-top: var(--tb-space-3);
    }

    .tb-deliveries__reason {
      overflow-wrap: anywhere;
    }
  `,
})
export class FailedDeliveriesCard {
  protected readonly t = T.page;

  /** The latest first. */
  readonly deliveries = input.required<FailedDelivery[]>();

  protected readonly open = signal(false);
  protected readonly when = dayTime;

  /** The reason in plain words (sketch Details): a blocked bot says so, the rest shows the messenger's answer. */
  protected reason(row: FailedDelivery): string {
    if (row.error === null) {
      return '';
    }
    return ' · ' + (/block/i.test(row.error) ? this.t.botBlocked : row.error);
  }

  protected messengerName(row: FailedDelivery): string {
    return MESSENGERS.find((messenger) => messenger.type === row.channel)?.name ?? row.channel;
  }
}
