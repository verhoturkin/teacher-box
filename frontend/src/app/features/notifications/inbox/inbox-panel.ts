import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tooltip } from 'primeng/tooltip';
import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from '@core/http/error-messages';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { Snackbar } from '@core/snackbar/snackbar';
import { NotificationsApi } from '../data-access/notifications-api';
import { NotificationItem } from '../data-access/notifications.models';
import { KIND_ICONS } from '../notification-labels';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';

export const PAGE_SIZE = 20;

/** Notifications of the current user in the personal area. */
@Component({
  selector: 'tb-inbox-panel',
  imports: [EmptyState, DatePipe, Button, Card, Tooltip, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <tb-load-state [state]="state" what="уведомления" (retry)="reload()">
        <div class="tb-inbox-header">
          <span class="tb-muted">
            @if (unread() > 0) {
              Непрочитанных: {{ unread() }}
            } @else {
              Все уведомления прочитаны
            }
          </span>
          <p-button
            label="Прочитать все"
            icon="pi pi-check"
            severity="secondary"
            [disabled]="unread() === 0"
            (onClick)="markAllRead()"
          />
        </div>
        @if (items(); as items) {
          @if (items.length === 0) {
            <tb-empty-state icon="pi-bell" title="Уведомлений пока нет" />
          } @else {
            <ul class="tb-list tb-notifications">
              @for (item of items; track item.id) {
                <li class="tb-notification" [class.tb-notification--unread]="!item.read">
                  <span
                    class="tb-list__lead"
                    [class.tb-list__lead--accent]="!item.read"
                    aria-hidden="true"
                    ><i [class]="icons[item.kind]"></i
                  ></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title tb-notification__title">{{ item.title }}</span>
                    @if (item.body !== null) {
                      <span class="tb-list__supporting tb-notification__body">{{ item.body }}</span>
                    }
                    <span class="tb-list__supporting">{{
                      item.createdAt | date: 'dd.MM.yyyy HH:mm'
                    }}</span>
                  </div>
                  <div class="tb-list__trail">
                    @if (item.link !== null) {
                      <p-button label="Открыть" [text]="true" (onClick)="open(item)" />
                    }
                    @if (!item.read) {
                      <p-button
                        icon="pi pi-check"
                        [text]="true"
                        pTooltip="Отметить прочитанным"
                        [rounded]="true"
                        severity="secondary"
                        ariaLabel="Отметить прочитанным"
                        (onClick)="markRead(item)"
                      />
                    }
                  </div>
                </li>
              }
            </ul>
            @if (items.length < total()) {
              <p-button
                label="Показать ещё"
                [text]="true"
                [loading]="loading()"
                (onClick)="loadMore()"
              />
            }
          }
        }
      </tb-load-state>
    </p-card>
  `,
  styles: `
    .tb-inbox-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-4);
      margin-bottom: var(--tb-space-2);
    }

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
export class InboxPanel implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly unreadCounter = inject(UnreadNotifications);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);

  protected readonly icons = KIND_ICONS;
  protected readonly items = signal<NotificationItem[] | null>(null);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly unread = this.unreadCounter.count;
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load(0);
  }

  protected reload(): void {
    this.load(0);
  }

  loadMore(): void {
    const loaded = this.items()?.length ?? 0;
    this.load(Math.floor(loaded / PAGE_SIZE), true);
  }

  open(item: NotificationItem): void {
    if (!item.read) {
      this.markRead(item);
    }
    if (item.link !== null) {
      void this.router.navigateByUrl(item.link);
    }
  }

  markRead(item: NotificationItem): void {
    this.api.markRead(item.id).subscribe(() => {
      this.items.update(
        (items) =>
          items?.map((other) => (other.id === item.id ? { ...other, read: true } : other)) ?? null,
      );
      this.unreadCounter.set(this.unread() - 1);
    });
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe(() => {
      this.items.update((items) => items?.map((item) => ({ ...item, read: true })) ?? null);
      this.unreadCounter.set(0);
    });
  }

  /**
   * Loads a page; items already shown are kept, so pages are requested in order. The first load is
   * the state of the panel (ADR-0025), a failed «Показать ещё» is a snackbar.
   */
  private load(page: number, more = false): void {
    this.loading.set(true);
    const request = this.api.page(page, PAGE_SIZE);
    (more ? request : request.pipe(this.state.track())).subscribe({
      next: (result) => {
        this.loading.set(false);
        const known = new Set((this.items() ?? []).map((item) => item.id));
        const fresh = result.items.filter((item) => !known.has(item.id));
        this.items.set(page === 0 ? result.items : [...(this.items() ?? []), ...fresh]);
        this.total.set(result.total);
        this.unreadCounter.set(result.unread);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (error instanceof HttpErrorResponse) {
          this.snackbar.error(errorMessage(error));
        }
      },
      complete: () => {
        this.loading.set(false);
      },
    });
  }
}
