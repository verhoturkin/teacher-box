import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { injectMobile } from '@core/layout/mobile';
import { Busy } from '@shared/ui/busy';
import { Swipe } from '@shared/ui/swipe';
import { NotificationItem } from '../data-access/notifications.models';
import { T } from '../i18n/texts';

/**
 * Notifications as a list without icons: title, text and time; «Открыть» and «Отметить прочитанным» (on a phone
 * a swipe sideways too).
 */
@Component({
  selector: 'tb-notification-list',
  imports: [DatePipe, Button, Swipe, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="tb-list tb-list--no-lead tb-notifications" [attr.aria-label]="label()">
      @for (item of items(); track item.id) {
        <li
          class="tb-notification"
          [class.tb-notification--unread]="!item.read"
          [tbSwipe]="mobile() && !item.read"
          (tbSwiped)="markRead.emit(item)"
        >
          <div class="tb-list__text">
            <span class="tb-list__title tb-notification__title">{{ item.title }}</span>
            @if (item.body !== null) {
              <span class="tb-list__supporting tb-notification__body">{{ item.body }}</span>
            }
            <span class="tb-list__supporting">{{ item.createdAt | date: 'dd.MM.yyyy HH:mm' }}</span>
          </div>
          <div class="tb-list__trail">
            @if (item.link !== null) {
              <p-button
                [label]="t.open"
                [text]="true"
                [ariaLabel]="t.openOf(item.title)"
                (onClick)="opened.emit(item)"
              />
            }
            @if (!item.read) {
              <p-button
                icon="pi pi-check"
                [text]="true"
                [pTooltip]="t.markRead"
                [rounded]="true"
                severity="secondary"
                [ariaLabel]="t.markRead"
                [loading]="busy().is('read-' + item.id)"
                (onClick)="markRead.emit(item)"
              />
            }
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    .tb-notifications {
      margin-bottom: var(--tb-space-2);
    }

    .tb-notification {
      align-items: flex-start;
    }

    .tb-notification--unread .tb-notification__title {
      font-weight: 500;
    }

    /* the text may hold a link to a meeting: a long address breaks anywhere (ADR-0021) */
    .tb-notification__body {
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
  `,
})
export class NotificationList {
  protected readonly t = T.list;
  readonly items = input.required<readonly NotificationItem[]>();
  readonly label = input.required<string>();
  /** The requests of the panel: «Отметить прочитанным» spins while its request runs. */
  readonly busy = input.required<Busy>();
  readonly opened = output<NotificationItem>();
  readonly markRead = output<NotificationItem>();

  /** A phone: a swipe sideways marks an unread notification read. */
  protected readonly mobile = injectMobile();
}
