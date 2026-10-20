import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { NotificationsApi } from '../data-access/notifications-api';
import { BroadcastItem } from '../data-access/notifications.models';
import { EmptyState } from '@shared/ui/empty-state';
import { NewMessageState } from '@core/notifications/new-message';
import { T } from '../i18n/texts';

/**
 * Teacher: the messages sent to students (the tab «Отправленные» of the bell's sheet); «Написать ученикам»
 * opens the frame's dialog of a new message, the list refreshes when one is sent.
 */
@Component({
  selector: 'tb-broadcasts-panel',
  imports: [DatePipe, Button, Card, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <div class="tb-broadcasts-header">
        <p class="tb-muted">{{ t.about }}</p>
        <p-button
          [label]="t.write"
          severity="secondary"
          icon="tb-i tb-i-send"
          (onClick)="openBroadcast()"
        />
      </div>
      @if (history(); as history) {
        @if (history.length === 0) {
          <tb-empty-state icon="tb-i-send" [title]="t.empty" />
        } @else {
          <ul class="tb-list tb-broadcasts">
            @for (item of history; track item.id) {
              <li class="tb-broadcast">
                <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-send"></i></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ item.title }}</span>
                  @if (item.body !== null) {
                    <span class="tb-list__supporting tb-broadcast__body">{{ item.body }}</span>
                  }
                  <span class="tb-list__supporting">
                    {{ item.createdAt | date: 'dd.MM.yyyy HH:mm' }} ·
                    {{ t.recipients(item.recipients) }}
                  </span>
                </div>
              </li>
            }
          </ul>
        }
      }
    </p-card>
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
export class BroadcastsPanel {
  protected readonly t = T.broadcasts;
  private readonly api = inject(NotificationsApi);
  private readonly newMessage = inject(NewMessageState);

  protected readonly history = signal<BroadcastItem[] | null>(null);

  constructor() {
    // on arrival and after each message sent (from here or from «Создать › Сообщение»)
    effect(() => {
      this.newMessage.sent();
      this.reload();
    });
  }

  openBroadcast(): void {
    this.newMessage.show();
  }

  private reload(): void {
    this.api.broadcasts().subscribe((history) => {
      this.history.set(history);
    });
  }
}
