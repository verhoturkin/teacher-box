import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import type { HomeworkSummary } from '@features/homework/parts';
import type { TeacherNotificationsSummary } from '@features/notifications/parts';
import type { ScheduleSummary } from '@features/schedule/parts';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from './i18n/texts';

interface AttentionItem {
  readonly icon: string;
  readonly text: string;
  readonly count: number;
  readonly link: string;
  readonly query?: Readonly<Record<string, string>>;
}

/** Teacher's home: what is waiting for the teacher across the modules. */
@Component({
  selector: 'tb-attention-card',
  imports: [EmptyState, RouterLink, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      @if (items().length === 0) {
        <tb-empty-state [compact]="true" icon="tb-i-check_circle" [title]="t.nothing" />
      } @else {
        <ul class="tb-list tb-attention">
          @for (item of items(); track item.text) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"><i [class]="item.icon"></i></span>
              <span class="tb-list__text">
                <a
                  [routerLink]="item.link"
                  [queryParams]="item.query"
                  class="tb-list__title tb-link"
                  >{{ item.text }}</a
                >
              </span>
              <span class="tb-list__trail"
                ><span class="tb-attention__count">{{ item.count }}</span></span
              >
            </li>
          }
        </ul>
      }
    </p-card>
  `,
  styles: `
    .tb-attention__count {
      min-width: 1.5rem;
      padding: var(--tb-space-1) var(--tb-space-2);
      border-radius: var(--tb-shape-full);
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
      font: var(--tb-type-label-l);
      text-align: center;
    }
  `,
})
export class AttentionCard {
  protected readonly t = T.attention;
  readonly schedule = input<ScheduleSummary | null>(null);
  readonly homework = input<HomeworkSummary | null>(null);
  readonly notifications = input<TeacherNotificationsSummary | null>(null);

  protected readonly items = computed<AttentionItem[]>(() => {
    const schedule = this.schedule();
    const homework = this.homework();
    const notifications = this.notifications();
    const items: AttentionItem[] = [
      {
        icon: 'tb-i tb-i-event_upcoming',
        text: T.attention.unmarked,
        count: schedule?.unmarked ?? 0,
        link: '/teacher/schedule',
      },
      {
        icon: 'tb-i tb-i-help',
        text: T.attention.requests,
        count: schedule?.pendingRequests ?? 0,
        link: '/teacher/schedule',
      },
      {
        icon: 'tb-i tb-i-inbox',
        text: T.attention.toReview,
        count: homework?.toReview ?? 0,
        link: '/teacher/homework/review',
      },
      {
        icon: 'tb-i tb-i-schedule',
        text: T.attention.overdue,
        count: homework?.overdue ?? 0,
        link: '/teacher/homework',
      },
      {
        icon: 'tb-i tb-i-warning',
        text: T.attention.failedDeliveries,
        count: notifications?.failedDeliveries ?? 0,
        link: '/teacher/notifications',
        query: { tab: 'students' },
      },
    ];
    return items.filter((item) => item.count > 0);
  });
}
