import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from '@core/http/error-messages';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { Snackbar } from '@core/snackbar/snackbar';
import { NotificationsApi } from '../data-access/notifications-api';
import { NotificationItem } from '../data-access/notifications.models';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { Busy } from '@shared/ui/busy';
import { NotificationList } from './notification-list';

export const PAGE_SIZE = 20;

/** Loaded notifications of one part of the inbox (unread or read ones) and how many there are. */
interface InboxPart {
  readonly items: NotificationItem[];
  readonly total: number;
}

/**
 * Notifications of the current user in the personal area: the unread ones on top, the read ones in
 * the folded «Прочитанные» (loaded when it is opened). A notification marked read moves there.
 */
@Component({
  selector: 'tb-inbox-panel',
  imports: [EmptyState, Button, Card, ButtonAttributes, LoadStateView, NotificationList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <tb-load-state [state]="state" what="уведомления" (retry)="reload()">
        @if (unreadPart(); as part) {
          @if (part.items.length === 0) {
            <tb-empty-state icon="pi-bell" title="Новых уведомлений нет" />
          } @else {
            <div class="tb-inbox-header">
              <span class="tb-muted">Непрочитанных: {{ unread() }}</span>
              <p-button
                label="Прочитать все"
                icon="pi pi-check"
                severity="secondary"
                [loading]="busy.is('all')"
                (onClick)="markAllRead()"
              />
            </div>
            <tb-notification-list
              label="Непрочитанные"
              [items]="part.items"
              [busy]="busy"
              (opened)="open($event)"
              (markRead)="markRead($event)"
            />
            @if (part.items.length < part.total) {
              <p-button
                label="Показать ещё"
                [text]="true"
                [loading]="busy.is('more-unread')"
                (onClick)="loadMore()"
              />
            }
          }
        }
        <div class="tb-inbox-read">
          <p-button
            label="Прочитанные"
            [icon]="readOpen() ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
            iconPos="right"
            [text]="true"
            severity="secondary"
            [tbAttributes]="{
              'aria-expanded': readOpen() ? 'true' : 'false',
              'aria-controls': 'tb-inbox-read',
            }"
            (onClick)="toggleRead()"
          />
          <div id="tb-inbox-read" role="region" aria-label="Прочитанные">
            @if (readOpen()) {
              <tb-load-state
                [state]="readState"
                what="прочитанные уведомления"
                [compact]="true"
                (retry)="loadRead(0)"
              >
                @if (readPart(); as part) {
                  @if (part.items.length === 0) {
                    <tb-empty-state icon="pi-inbox" title="Прочитанных уведомлений нет" />
                  } @else {
                    <tb-notification-list
                      label="Прочитанные уведомления"
                      [items]="part.items"
                      [busy]="busy"
                      (opened)="open($event)"
                      (markRead)="markRead($event)"
                    />
                    @if (part.items.length < part.total) {
                      <p-button
                        label="Показать ещё"
                        [text]="true"
                        [loading]="busy.is('more-read')"
                        (onClick)="loadMoreRead()"
                      />
                    }
                  }
                }
              </tb-load-state>
            }
          </div>
        </div>
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

    .tb-inbox-read {
      margin-top: var(--tb-space-4);
      padding-top: var(--tb-space-2);
      border-top: 1px solid var(--p-md-outline-variant);
    }

    /* the opened list keeps its distance from the «Прочитанные» button */
    #tb-inbox-read:not(:empty) {
      margin-top: var(--tb-space-2);
    }
  `,
})
export class InboxPanel implements OnInit {
  protected readonly busy = new Busy();
  private readonly api = inject(NotificationsApi);
  private readonly unreadCounter = inject(UnreadNotifications);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);

  protected readonly unreadPart = signal<InboxPart | null>(null);
  /** `null` until «Прочитанные» is opened (or after «Прочитать все»: loaded again when opened). */
  protected readonly readPart = signal<InboxPart | null>(null);
  protected readonly readOpen = signal(false);
  protected readonly unread = this.unreadCounter.count;
  protected readonly state = new LoadState();
  protected readonly readState = new LoadState();

  ngOnInit(): void {
    this.loadUnread(0);
  }

  protected reload(): void {
    this.loadUnread(0);
  }

  loadMore(): void {
    this.loadUnread(nextPage(this.unreadPart()), true);
  }

  loadMoreRead(): void {
    this.loadRead(nextPage(this.readPart()), true);
  }

  protected toggleRead(): void {
    this.readOpen.update((open) => !open);
    if (this.readOpen() && this.readPart() === null) {
      this.loadRead(0);
    }
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
    this.busy.guard('read-' + item.id, this.api.markRead(item.id)).subscribe(() => {
      this.unreadPart.update((part) => part && without(part, item.id));
      this.readPart.update((part) => part && withRead(part, { ...item, read: true }));
      this.unreadCounter.set(Math.max(0, this.unread() - 1));
    });
  }

  markAllRead(): void {
    this.busy.guard('all', this.api.markAllRead()).subscribe(() => {
      this.unreadPart.set({ items: [], total: 0 });
      this.unreadCounter.set(0);
      this.readPart.set(null);
      if (this.readOpen()) {
        this.loadRead(0);
      }
    });
  }

  /** The unread notifications; the first load is the state of the panel (ADR-0025). */
  private loadUnread(page: number, more = false): void {
    const request = this.api.page(page, PAGE_SIZE, false);
    const load = more ? this.busy.guard('more-unread', request) : request.pipe(this.state.track());
    load.subscribe({
      next: (result) => {
        this.unreadPart.set(merged(more ? this.unreadPart() : null, result.items, result.total));
        this.unreadCounter.set(result.unread);
      },
      error: (error: unknown) => {
        this.failed(error);
      },
    });
  }

  /** The read notifications; the first load is the state of «Прочитанные». */
  loadRead(page: number, more = false): void {
    const request = this.api.page(page, PAGE_SIZE, true);
    const load = more
      ? this.busy.guard('more-read', request)
      : request.pipe(this.readState.track());
    load.subscribe({
      next: (result) => {
        this.readPart.set(merged(more ? this.readPart() : null, result.items, result.total));
      },
      error: (error: unknown) => {
        this.failed(error);
      },
    });
  }

  /** A failed «Показать ещё» is a snackbar; a failed first load is shown by `tb-load-state`. */
  private failed(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      this.snackbar.error(errorMessage(error));
    }
  }
}

/** The page after the loaded items; items already shown are kept, so pages are requested in order. */
function nextPage(part: InboxPart | null): number {
  return Math.floor((part?.items.length ?? 0) / PAGE_SIZE);
}

function merged(part: InboxPart | null, items: NotificationItem[], total: number): InboxPart {
  if (part === null) {
    return { items, total };
  }
  const known = new Set(part.items.map((item) => item.id));
  return { items: [...part.items, ...items.filter((item) => !known.has(item.id))], total };
}

function without(part: InboxPart, id: string): InboxPart {
  return { items: part.items.filter((item) => item.id !== id), total: Math.max(0, part.total - 1) };
}

/** A notification just read takes its place among the read ones (newest first). */
function withRead(part: InboxPart, item: NotificationItem): InboxPart {
  const items = [...part.items, item].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
  return { items, total: part.total + 1 };
}
