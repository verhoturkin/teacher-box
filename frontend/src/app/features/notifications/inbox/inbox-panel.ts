import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tooltip } from 'primeng/tooltip';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { NotificationsApi } from '../data-access/notifications-api';
import { NotificationItem } from '../data-access/notifications.models';
import { KIND_ICONS } from '../notification-labels';
import { EmptyState } from '@shared/ui/empty-state';

export const PAGE_SIZE = 20;

/** Notifications of the current user in the personal area. */
@Component({
  selector: 'tb-inbox-panel',
  imports: [EmptyState, DatePipe, Button, Card, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
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
          <ul class="tb-notifications">
            @for (item of items; track item.id) {
              <li class="tb-notification" [class.tb-notification--unread]="!item.read">
                <i [class]="icons[item.kind]" aria-hidden="true"></i>
                <div class="tb-notification__content">
                  <div class="tb-notification__title">{{ item.title }}</div>
                  @if (item.body !== null) {
                    <div class="tb-notification__body">{{ item.body }}</div>
                  }
                  <small class="tb-muted">{{ item.createdAt | date: 'dd.MM.yyyy HH:mm' }}</small>
                </div>
                <div class="tb-notification__actions">
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
      display: flex;
      flex-direction: column;
      margin: 0 0 var(--tb-space-2);
      padding: 0;
      list-style: none;
    }

    /* M3 list item: the icon in a tonal circle, the text, the actions (under the text on a phone) */
    .tb-notification {
      display: grid;
      grid-template-columns: 2.5rem minmax(0, 1fr) auto;
      grid-template-areas: 'icon content actions';
      gap: var(--tb-space-1) var(--tb-space-4);
      align-items: start;
      padding: var(--tb-space-3) 0;
      border-bottom: 1px solid var(--p-md-outline-variant);

      @media (max-width: 768px) {
        grid-template-columns: 2.5rem minmax(0, 1fr);
        grid-template-areas: 'icon content' '. actions';
      }

      > i {
        display: flex;
        grid-area: icon;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: var(--tb-shape-full);
        background: var(--p-md-surface-container-highest);
        color: var(--p-md-on-surface-variant);
        font-size: 1.125rem;
      }
    }

    .tb-notification--unread {
      .tb-notification__title {
        font-weight: 600;
      }

      > i {
        background: var(--p-md-primary-container);
        color: var(--p-md-on-primary-container);
      }
    }

    .tb-notification__content {
      display: flex;
      grid-area: content;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .tb-notification__title {
      font: var(--tb-type-title-s);
      font-size: 1rem;
      line-height: 1.5rem;
    }

    .tb-notification__body {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .tb-notification__actions {
      display: flex;
      grid-area: actions;
      align-items: center;
    }
  `,
})
export class InboxPanel implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly unreadCounter = inject(UnreadNotifications);
  private readonly router = inject(Router);

  protected readonly icons = KIND_ICONS;
  protected readonly items = signal<NotificationItem[] | null>(null);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly unread = this.unreadCounter.count;

  ngOnInit(): void {
    this.load(0);
  }

  loadMore(): void {
    const loaded = this.items()?.length ?? 0;
    this.load(Math.floor(loaded / PAGE_SIZE));
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

  /** Loads a page; items already shown are kept, so pages are requested in order. */
  private load(page: number): void {
    this.loading.set(true);
    this.api.page(page, PAGE_SIZE).subscribe({
      next: (result) => {
        this.loading.set(false);
        const known = new Set((this.items() ?? []).map((item) => item.id));
        const fresh = result.items.filter((item) => !known.has(item.id));
        this.items.set(page === 0 ? result.items : [...(this.items() ?? []), ...fresh]);
        this.total.set(result.total);
        this.unreadCounter.set(result.unread);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
