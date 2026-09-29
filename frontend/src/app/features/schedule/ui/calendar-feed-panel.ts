import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { Portal } from '@core/portal/portal';
import { ScheduleApi } from '../data-access/schedule-api';
import { CalendarFeed } from '../data-access/schedule.models';

/**
 * Subscription to the schedule from Google, Apple or Yandex Calendar by a secret link. The link is
 * shown once, right after it is created; a new link replaces the old one.
 */
@Component({
  selector: 'tb-calendar-feed-panel',
  imports: [DatePipe, Button, Card, InputText, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Календарь на телефоне">
      @if (feed(); as feed) {
        @if (url(); as link) {
          <p>Скопируйте ссылку и добавьте её в календарь. Больше она показана не будет.</p>
          <div class="tb-feed-link">
            <input pInputText [value]="link" readonly aria-label="Ссылка на календарь" />
            <p-button
              icon="pi pi-copy"
              [text]="true"
              pTooltip="Копировать ссылку"
              [rounded]="true"
              severity="secondary"
              ariaLabel="Копировать ссылку"
              (onClick)="copy(link)"
            />
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
            severity="secondary"
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
      gap: var(--tb-space-2);

      input {
        flex: 1;
        min-width: 0;
      }
    }

    .tb-feed-help {
      margin: var(--tb-space-3) 0 var(--tb-space-2);
      padding-left: var(--tb-space-5);
    }

    .tb-actions {
      margin-top: var(--tb-space-3);
    }
  `,
})
export class CalendarFeedPanel implements OnInit {
  private readonly api = inject(ScheduleApi);
  private readonly messages = inject(MessageService);
  private readonly clipboard = inject(Clipboard);
  private readonly portal = inject(Portal);

  protected readonly feed = signal<CalendarFeed | null>(null);
  protected readonly pending = signal(false);
  protected readonly url = computed(() => {
    const path = this.feed()?.path ?? null;
    return path === null ? null : this.portal.link(path);
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
      this.messages.add({
        severity: 'success',
        summary: 'Скопировано',
        detail: 'Ссылка в буфере обмена',
      });
    }
  }
}
