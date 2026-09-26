import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { ScheduleApi } from '../data-access/schedule-api';
import { CalendarFeed } from '../data-access/schedule.models';

/**
 * Subscription to the schedule from Google, Apple or Yandex Calendar by a secret link. The link is
 * shown once, right after it is created; a new link replaces the old one.
 */
@Component({
  selector: 'tb-calendar-feed-panel',
  imports: [DatePipe, Button, Card, InputText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Календарь на телефоне">
      @if (feed(); as feed) {
        @if (url(); as link) {
          <p>Скопируйте ссылку и добавьте её в календарь. Больше она показана не будет.</p>
          <div class="tb-feed-link">
            <input pInputText [value]="link" readonly aria-label="Ссылка на календарь" />
            <p-button icon="pi pi-copy" [text]="true" ariaLabel="Копировать ссылку" (onClick)="copy(link)" />
          </div>
          <ul class="tb-muted tb-feed-help">
            <li>Google Календарь: «Другие календари» → «+» → «Добавить по URL».</li>
            <li>iPhone и Mac: <a [href]="webcal()">открыть в Календаре</a>.</li>
            <li>Яндекс Календарь: «Новый календарь» → «Импорт» → «По ссылке».</li>
          </ul>
          <small class="tb-muted">Google обновляет подписки раз в несколько часов.</small>
        } @else if (feed.enabled) {
          <p class="tb-muted">Ссылка создана {{ feed.createdAt | date: 'dd.MM.yyyy' }}.</p>
        } @else {
          <p class="tb-muted">Занятия могут появляться в календаре на телефоне.</p>
        }
        <div class="tb-actions">
          <p-button
            [label]="feed.enabled ? 'Новая ссылка' : 'Получить ссылку'"
            icon="pi pi-link"
            [outlined]="feed.enabled"
            [loading]="pending()"
            (onClick)="create()"
          />
          @if (feed.enabled) {
            <p-button label="Отключить" severity="secondary" [text]="true" (onClick)="disable()" />
          }
        </div>
      }
    </p-card>
  `,
  styles: `
    .tb-feed-link {
      display: flex;
      gap: 0.5rem;

      input {
        flex: 1;
        min-width: 0;
      }
    }

    .tb-feed-help {
      margin: 0.75rem 0 0.5rem;
      padding-left: 1.25rem;
    }

    .tb-actions {
      margin-top: 0.75rem;
    }
  `,
})
export class CalendarFeedPanel implements OnInit {
  private readonly api = inject(ScheduleApi);
  private readonly messages = inject(MessageService);
  private readonly clipboard = inject(Clipboard);

  protected readonly feed = signal<CalendarFeed | null>(null);
  protected readonly pending = signal(false);
  protected readonly url = computed(() => {
    const path = this.feed()?.path ?? null;
    return path === null ? null : window.location.origin + path;
  });
  protected readonly webcal = computed(() => this.url()?.replace(/^https?:/, 'webcal:') ?? '');

  ngOnInit(): void {
    this.api.feed().subscribe((feed) => {
      this.feed.set(feed);
    });
  }

  create(): void {
    this.pending.set(true);
    this.api.createFeed().subscribe({
      next: (feed) => {
        this.pending.set(false);
        this.feed.set(feed);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  disable(): void {
    this.api.disableFeed().subscribe(() => {
      this.feed.set({ enabled: false, createdAt: null, path: null });
    });
  }

  copy(link: string): void {
    if (this.clipboard.copy(link)) {
      this.messages.add({ severity: 'success', summary: 'Скопировано', detail: 'Ссылка в буфере обмена' });
    }
  }
}
