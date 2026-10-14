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
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { Portal } from '@core/portal/portal';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { ScheduleApi } from '../data-access/schedule-api';
import { CalendarFeed } from '../data-access/schedule.models';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { T } from '../i18n/texts';

/**
 * Subscription to the schedule from Google, Apple or Yandex Calendar by a secret link. The link is
 * shown once, right after it is created; a new link replaces the old one.
 */
@Component({
  selector: 'tb-calendar-feed-panel',
  imports: [DatePipe, Button, Card, InputText, Tooltip, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <tb-load-state [state]="state" [what]="t.what" [compact]="true" (retry)="load()">
        @if (feed(); as feed) {
          @if (url(); as link) {
            <p>{{ t.copyHint }}</p>
            <div class="tb-field">
              <label for="calendar-feed-link">{{ t.link }}</label>
              <div class="tb-copy-row">
                <input pInputText id="calendar-feed-link" class="tb-grow" [value]="link" readonly />
                <p-button
                  icon="pi pi-copy"
                  [text]="true"
                  [pTooltip]="t.copy"
                  [rounded]="true"
                  severity="secondary"
                  [ariaLabel]="t.copy"
                  (onClick)="copy(link)"
                />
              </div>
            </div>
            <ul class="tb-muted tb-feed-help">
              <li>{{ t.google }}</li>
              <li>
                {{ t.appleBefore }} <a [href]="webcal()">{{ t.apple }}</a
                >.
              </li>
              <li>{{ t.yandex }}</li>
            </ul>
            <small class="tb-muted">{{ t.refresh }}</small>
          } @else if (feed.enabled) {
            <p class="tb-muted">{{ t.created((feed.createdAt | date: 'dd.MM.yyyy') ?? '') }}</p>
          } @else {
            <p class="tb-muted">{{ t.about }}</p>
          }
          <div class="tb-actions">
            <p-button
              [label]="feed.enabled ? t.renew : t.get"
              icon="pi pi-link"
              severity="secondary"
              [loading]="pending()"
              (onClick)="create()"
            />
            @if (feed.enabled) {
              <p-button
                [label]="t.disable"
                severity="danger"
                [text]="true"
                [loading]="busy.is('disable')"
                (onClick)="disable()"
              />
            }
          </div>
        }
      </tb-load-state>
    </p-card>
  `,
  styles: `
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
  protected readonly t = T.feed;
  protected readonly busy = new Busy();
  private readonly api = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);
  private readonly clipboard = inject(Clipboard);
  private readonly portal = inject(Portal);

  protected readonly feed = signal<CalendarFeed | null>(null);
  protected readonly pending = signal(false);
  protected readonly url = computed(() => {
    const path = this.feed()?.path ?? null;
    return path === null ? null : this.portal.link(path);
  });
  protected readonly webcal = computed(() => this.url()?.replace(/^https?:/, 'webcal:') ?? '');
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .feed()
      .pipe(this.state.track())
      .subscribe((feed) => {
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
    this.busy.guard('disable', this.api.disableFeed()).subscribe(() => {
      this.feed.set({ enabled: false, createdAt: null, path: null });
    });
  }

  copy(link: string): void {
    if (this.clipboard.copy(link)) {
      this.snackbar.success(T.feed.copied);
    }
  }
}
