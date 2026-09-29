import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { NotificationsApi } from '../data-access/notifications-api';
import { NotificationItem } from '../data-access/notifications.models';
import { KIND_ICONS } from '../notification-labels';
import { EmptyState } from '@shared/ui/empty-state';

export const LATEST_COUNT = 5;

/** Home: the latest notifications with a link to all of them. */
@Component({
  selector: 'tb-latest-notifications-widget',
  imports: [EmptyState, DatePipe, RouterLink, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Уведомления">
      @if (items(); as items) {
        @if (items.length === 0) {
          <tb-empty-state icon="pi-bell" title="Уведомлений пока нет" />
        } @else {
          <ul class="tb-list tb-latest">
            @for (item of items; track item.id) {
              <li [class.tb-latest--unread]="!item.read">
                <span
                  class="tb-list__lead"
                  [class.tb-list__lead--accent]="!item.read"
                  aria-hidden="true"
                  ><i [class]="icons[item.kind]"></i
                ></span>
                <div class="tb-list__text">
                  <button
                    type="button"
                    class="tb-list__title tb-latest__title"
                    [disabled]="item.link === null"
                    (click)="open(item)"
                  >
                    {{ item.title }}
                  </button>
                  <span class="tb-list__supporting">{{
                    item.createdAt | date: 'dd.MM HH:mm'
                  }}</span>
                </div>
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
    .tb-latest--unread .tb-latest__title {
      font-weight: 500;
    }

    .tb-latest__title {
      padding: 0;
      border: 0;
      background: none;
      text-align: left;
      cursor: pointer;

      &:disabled {
        cursor: default;
      }

      &:focus-visible {
        outline: 2px solid var(--p-md-primary);
        outline-offset: 2px;
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
