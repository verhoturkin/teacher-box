import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tooltip } from 'primeng/tooltip';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { NotificationsApi } from '../data-access/notifications-api';
import { NotificationItem, NotificationPage } from '../data-access/notifications.models';
import { KIND_ICONS } from '../notification-labels';
import { Busy } from '@shared/ui/busy';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';

export const LATEST_COUNT = 5;

/**
 * Home: the latest unread notifications with «Отметить прочитанным» each, «Прочитать все» and a link to
 * all of them. A notification read here leaves the list; the next unread one takes its place.
 */
@Component({
  selector: 'tb-latest-notifications-widget',
  imports: [EmptyState, DatePipe, RouterLink, Card, Button, Tooltip, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text">Уведомления</span>
          @if (items()?.length) {
            <div class="tb-card-title__actions">
              <p-button
                label="Прочитать все"
                icon="pi pi-check"
                severity="secondary"
                [loading]="busy.is('all')"
                (onClick)="markAllRead()"
              />
            </div>
          }
        </div>
      </ng-template>
      <tb-load-state [state]="state" what="уведомления" [compact]="true" (retry)="load()">
        @if (items(); as items) {
          @if (items.length === 0) {
            <tb-empty-state icon="pi-bell" title="Новых уведомлений нет" />
          } @else {
            <ul class="tb-list tb-latest" aria-label="Непрочитанные уведомления">
              @for (item of items; track item.id) {
                <li>
                  <span class="tb-list__lead tb-list__lead--accent" aria-hidden="true"
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
                      item.createdAt | date: 'dd.MM.yyyy HH:mm'
                    }}</span>
                  </div>
                  <div class="tb-list__trail">
                    <p-button
                      icon="pi pi-check"
                      [text]="true"
                      [rounded]="true"
                      severity="secondary"
                      pTooltip="Отметить прочитанным"
                      [ariaLabel]="'Отметить прочитанным: ' + item.title"
                      [loading]="busy.is('read-' + item.id)"
                      (onClick)="markRead(item)"
                    />
                  </div>
                </li>
              }
            </ul>
          }
        }
      </tb-load-state>
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
    .tb-latest__title {
      padding: 0;
      border: 0;
      background: none;
      font-weight: 500;
      text-align: left;
      cursor: pointer;

      &:disabled {
        cursor: default;
      }

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }
    }
  `,
})
export class LatestNotificationsWidget implements OnInit {
  protected readonly busy = new Busy();
  private readonly api = inject(NotificationsApi);
  private readonly unreadCounter = inject(UnreadNotifications);
  private readonly router = inject(Router);

  /** The notifications page of the current area. */
  readonly link = input.required<string>();

  protected readonly icons = KIND_ICONS;
  /** The first unread notifications, newest first. */
  protected readonly items = signal<NotificationItem[] | null>(null);
  protected readonly unread = this.unreadCounter.count;
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.request()
      .pipe(this.state.track())
      .subscribe((page) => {
        this.show(page);
      });
  }

  open(item: NotificationItem): void {
    this.markRead(item);
    if (item.link !== null) {
      void this.router.navigateByUrl(item.link);
    }
  }

  markRead(item: NotificationItem): void {
    this.busy.guard('read-' + item.id, this.api.markRead(item.id)).subscribe(() => {
      const left = (this.items() ?? []).filter((candidate) => candidate.id !== item.id);
      const unread = Math.max(0, this.unread() - 1);
      this.items.set(left);
      this.unreadCounter.set(unread);
      if (left.length < unread) {
        this.request().subscribe((page) => {
          this.show(page);
        });
      }
    });
  }

  markAllRead(): void {
    this.busy.guard('all', this.api.markAllRead()).subscribe(() => {
      this.items.set([]);
      this.unreadCounter.set(0);
    });
  }

  private request(): Observable<NotificationPage> {
    return this.api.page(0, LATEST_COUNT, false);
  }

  private show(page: NotificationPage): void {
    this.items.set(page.items);
    this.unreadCounter.set(page.unread);
  }
}
