import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { AuthService } from '@core/auth/auth.service';
import { UnreadNotifications } from '@core/notifications/unread-notifications';
import { IdentityApi } from '@features/identity';
import { ChannelsPanel } from './channels/channels-panel';
import { NotificationsApi } from './data-access/notifications-api';
import { NotificationItem } from './data-access/notifications.models';
import { KIND_ICONS } from './notification-labels';
import { BroadcastDialog, Recipient } from './teacher/broadcast-dialog';

export const PAGE_SIZE = 20;

/** Notifications of the current user (teacher or student) and messenger settings. */
@Component({
  selector: 'tb-notifications-page',
  imports: [DatePipe, Button, Card, BroadcastDialog, ChannelsPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-page-header">
      <h1 class="tb-page-title">Уведомления</h1>
      <div class="tb-actions">
        @if (teacher) {
          <p-button label="Написать ученикам" icon="pi pi-send" (onClick)="openBroadcast()" />
        }
        <p-button
          label="Прочитать все"
          icon="pi pi-check"
          severity="secondary"
          [outlined]="true"
          [disabled]="unread() === 0"
          (onClick)="markAllRead()"
        />
      </div>
    </div>

    <div class="tb-notifications-layout">
      <p-card>
        @if (items(); as items) {
          @if (items.length === 0) {
            <p class="tb-muted">Уведомлений пока нет.</p>
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
                      <p-button label="Открыть" size="small" [text]="true" (onClick)="open(item)" />
                    }
                    @if (!item.read) {
                      <p-button
                        icon="pi pi-check"
                        size="small"
                        [text]="true"
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
              <p-button label="Показать ещё" [text]="true" [loading]="loading()" (onClick)="loadMore()" />
            }
          }
        }
      </p-card>
      <tb-channels-panel [teacher]="teacher" />
    </div>

    @if (teacher) {
      <tb-broadcast-dialog [(visible)]="broadcastVisible" [students]="students()" (sent)="onBroadcast($event)" />
    }
  `,
  styles: `
    .tb-notifications-layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: 1rem;
      align-items: start;

      @media (max-width: 900px) {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .tb-notifications {
      display: flex;
      flex-direction: column;
      margin: 0 0 0.5rem;
      padding: 0;
      list-style: none;
    }

    .tb-notification {
      display: flex;
      gap: 0.75rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--p-content-border-color);

      > i {
        margin-top: 0.2rem;
        color: var(--p-text-muted-color);
      }
    }

    .tb-notification--unread {
      .tb-notification__title {
        font-weight: 600;
      }

      > i {
        color: var(--p-primary-color);
      }
    }

    .tb-notification__content {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
    }

    .tb-notification__body {
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .tb-notification__actions {
      display: flex;
      align-items: flex-start;
    }
  `,
})
export class NotificationsPage implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly identity = inject(IdentityApi);
  private readonly unreadCounter = inject(UnreadNotifications);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  protected readonly teacher = inject(AuthService).user()?.role === 'TEACHER';
  protected readonly icons = KIND_ICONS;
  protected readonly items = signal<NotificationItem[] | null>(null);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly unread = this.unreadCounter.count;
  protected readonly broadcastVisible = signal(false);
  protected readonly students = signal<Recipient[]>([]);

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
      this.items.update((items) => items?.map((other) => (other.id === item.id ? { ...other, read: true } : other)) ?? null);
      this.unreadCounter.set(this.unread() - 1);
    });
  }

  markAllRead(): void {
    this.api.markAllRead().subscribe(() => {
      this.items.update((items) => items?.map((item) => ({ ...item, read: true })) ?? null);
      this.unreadCounter.set(0);
    });
  }

  openBroadcast(): void {
    this.identity.listStudents().subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
      this.broadcastVisible.set(true);
    });
  }

  onBroadcast(recipients: number): void {
    this.messages.add({ severity: 'success', summary: 'Отправлено', detail: `Получателей: ${String(recipients)}` });
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
