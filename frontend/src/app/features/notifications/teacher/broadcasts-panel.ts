import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { IdentityApi } from '@features/identity';
import { NotificationsApi } from '../data-access/notifications-api';
import { BroadcastItem } from '../data-access/notifications.models';
import { BroadcastDialog, Recipient } from './broadcast-dialog';

/** Teacher: writes to students and sees what was sent. */
@Component({
  selector: 'tb-broadcasts-panel',
  imports: [DatePipe, Button, Card, BroadcastDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <div class="tb-broadcasts-header">
        <p class="tb-muted">
          Сообщение придёт ученикам в личный кабинет и в подключённые мессенджеры — например, о каникулах или смене
          ссылки на урок.
        </p>
        <p-button label="Написать ученикам" icon="pi pi-send" (onClick)="openBroadcast()" />
      </div>
      @if (history(); as history) {
        @if (history.length === 0) {
          <p class="tb-muted">Вы ещё не отправляли сообщений.</p>
        } @else {
          <ul class="tb-broadcasts">
            @for (item of history; track item.id) {
              <li class="tb-broadcast">
                <div class="tb-broadcast__title">
                  <strong>{{ item.title }}</strong>
                  <small class="tb-muted">
                    {{ item.createdAt | date: 'dd.MM.yyyy HH:mm' }} · получателей: {{ item.recipients }}
                  </small>
                </div>
                @if (item.body !== null) {
                  <div class="tb-broadcast__body">{{ item.body }}</div>
                }
              </li>
            }
          </ul>
        }
      }
    </p-card>

    <tb-broadcast-dialog [(visible)]="broadcastVisible" [students]="students()" (sent)="onBroadcast($event)" />
  `,
  styles: `
    .tb-broadcasts-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;

      p {
        flex: 1;
        min-width: 16rem;
        margin: 0;
      }
    }

    .tb-broadcasts {
      display: flex;
      flex-direction: column;
      margin: 1rem 0 0;
      padding: 0;
      list-style: none;
    }

    .tb-broadcast {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem 0;
      border-top: 1px solid var(--p-content-border-color);
    }

    .tb-broadcast__title {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .tb-broadcast__body {
      white-space: pre-line;
      overflow-wrap: anywhere;
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
    this.messages.add({ severity: 'success', summary: 'Отправлено', detail: `Получателей: ${String(recipients)}` });
    this.reload();
  }

  private reload(): void {
    this.api.broadcasts().subscribe((history) => {
      this.history.set(history);
    });
  }
}
