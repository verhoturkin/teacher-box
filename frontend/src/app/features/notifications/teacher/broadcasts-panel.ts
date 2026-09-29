import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { IdentityApi } from '@features/identity/parts';
import { NotificationsApi } from '../data-access/notifications-api';
import { BroadcastItem } from '../data-access/notifications.models';
import { BroadcastDialog, Recipient } from './broadcast-dialog';
import { EmptyState } from '@shared/ui/empty-state';

/** Teacher: writes to students and sees what was sent. */
@Component({
  selector: 'tb-broadcasts-panel',
  imports: [DatePipe, Button, Card, BroadcastDialog, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <div class="tb-broadcasts-header">
        <p class="tb-muted">
          Сообщение придёт ученикам в личный кабинет и в подключённые мессенджеры — например, о
          каникулах или смене ссылки на урок.
        </p>
        <p-button
          label="Написать ученикам"
          severity="secondary"
          icon="pi pi-send"
          (onClick)="openBroadcast()"
        />
      </div>
      @if (history(); as history) {
        @if (history.length === 0) {
          <tb-empty-state icon="pi-send" title="Вы ещё не отправляли сообщений." />
        } @else {
          <ul class="tb-list tb-broadcasts">
            @for (item of history; track item.id) {
              <li class="tb-broadcast">
                <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-send"></i></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ item.title }}</span>
                  @if (item.body !== null) {
                    <span class="tb-list__supporting tb-broadcast__body">{{ item.body }}</span>
                  }
                  <span class="tb-list__supporting">
                    {{ item.createdAt | date: 'dd.MM.yyyy HH:mm' }} · получателей:
                    {{ item.recipients }}
                  </span>
                </div>
              </li>
            }
          </ul>
        }
      }
    </p-card>

    <tb-broadcast-dialog
      [(visible)]="broadcastVisible"
      [students]="students()"
      (sent)="onBroadcast($event)"
    />
  `,
  styles: `
    .tb-broadcasts-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-4);

      p {
        flex: 1;
        min-width: 16rem;
        margin: 0;
      }
    }

    .tb-broadcasts {
      margin-top: var(--tb-space-4);
    }

    .tb-broadcast {
      align-items: flex-start;
    }

    .tb-broadcast__body {
      white-space: pre-line;
    }
  `,
})
export class BroadcastsPanel implements OnInit {
  private readonly api = inject(NotificationsApi);
  private readonly identity = inject(IdentityApi);
  private readonly messages = inject(MessageService);

  protected readonly history = signal<BroadcastItem[] | null>(null);
  protected readonly broadcastVisible = signal(false);
  protected readonly students = signal<Recipient[]>([]);

  ngOnInit(): void {
    this.reload();
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
    this.messages.add({
      severity: 'success',
      summary: 'Отправлено',
      detail: `Получателей: ${String(recipients)}`,
    });
    this.reload();
  }

  private reload(): void {
    this.api.broadcasts().subscribe((history) => {
      this.history.set(history);
    });
  }
}
