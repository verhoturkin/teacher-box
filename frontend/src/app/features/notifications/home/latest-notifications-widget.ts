import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { NotificationsApi } from '../data-access/notifications-api';
import { NotificationItem } from '../data-access/notifications.models';
import { KIND_ICONS } from '../notification-labels';

export const LATEST_COUNT = 5;

/** Home: the latest notifications with a link to all of them. */
@Component({
  selector: 'tb-latest-notifications-widget',
  imports: [DatePipe, RouterLink, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Уведомления">
      @if (items(); as items) {
        @if (items.length === 0) {
          <p class="tb-muted">Уведомлений пока нет.</p>
        } @else {
          <ul class="tb-latest">
            @for (item of items; track item.id) {
              <li [class.tb-latest--unread]="!item.read">
                <i [class]="icons[item.kind]" aria-hidden="true"></i>
                <button type="button" class="tb-latest__title" [disabled]="item.link === null" (click)="open(item)">
                  {{ item.title }}
                </button>
                <small class="tb-muted">{{ item.createdAt | date: 'dd.MM HH:mm' }}</small>
              </li>
            }
          </ul>
        }
      }
      <div class="tb-widget-footer">
        <span class="tb-muted">
          @if (unread() > 0) {
            Непрочитанных: {{ unread() }}
          }
        </span>
        <a [routerLink]="link()">Все уведомления</a>
      </div>
    </p-card>
  `,
  styles: `
    .tb-latest {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        padding: 0.4rem 0;
        border-bottom: 1px solid var(--p-content-border-color);

        > i {
          color: var(--p-text-muted-color);
        }

        &.tb-latest--unread {
          .tb-latest__title {
            font-weight: 600;
          }

          > i {
            color: var(--p-primary-color);
          }
        }
      }
    }

    .tb-latest__title {
      flex: 1;
      min-width: 0;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      overflow-wrap: anywhere;
      cursor: pointer;

      &:disabled {
        cursor: default;
      }
    }
  `,
})
export class LatestNotificationsWidget implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly unreadCounter = inject(UnreadNotifications);
  private readonly router = inject(Router);

  /** The notifications page of the current area. */
  readonly link = input.required<string>();

  protected readonly icons = KIND_ICONS;
  protected readonly items = signal<NotificationItem[] | null>(null);
  protected readonly unread = this.unreadCounter.count;

  ngOnInit(): void {
    this.api.page(0, LATEST_COUNT).subscribe((page) => {
      this.items.set(page.items);
      this.unreadCounter.set(page.unread);
    });
  }

  open(item: NotificationItem): void {
    if (!item.read) {
      this.api.markRead(item.id).subscribe(() => {
        this.unreadCounter.set(Math.max(0, this.unread() - 1));
      });
    }
    if (item.link !== null) {
      void this.router.navigateByUrl(item.link);
    }
  }
}
