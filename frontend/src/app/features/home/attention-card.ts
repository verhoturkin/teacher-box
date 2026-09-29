import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import type { HomeworkSummary } from '@features/homework/parts';
import type { TeacherNotificationsSummary } from '@features/notifications/parts';
import type { ScheduleSummary } from '@features/schedule/parts';

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
  imports: [RouterLink, Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Требует внимания">
      @if (items().length === 0) {
        <p class="tb-muted">Срочных дел нет.</p>
      } @else {
        <ul class="tb-list tb-attention">
          @for (item of items(); track item.text) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"><i [class]="item.icon"></i></span>
              <a
                [routerLink]="item.link"
                [queryParams]="item.query"
                class="tb-list__text tb-list__title tb-link"
                >{{ item.text }}</a
              >
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
  readonly schedule = input<ScheduleSummary | null>(null);
  readonly homework = input<HomeworkSummary | null>(null);
  readonly notifications = input<TeacherNotificationsSummary | null>(null);

  protected readonly items = computed<AttentionItem[]>(() => {
    const schedule = this.schedule();
    const homework = this.homework();
    const notifications = this.notifications();
    const items: AttentionItem[] = [
      {
        icon: 'pi pi-calendar-clock',
        text: 'Отметьте прошедшие занятия',
        count: schedule?.unmarked ?? 0,
        link: '/teacher/schedule',
      },
      {
        icon: 'pi pi-question-circle',
        text: 'Запросы на перенос и отмену',
        count: schedule?.pendingRequests ?? 0,
        link: '/teacher/schedule',
      },
      {
        icon: 'pi pi-inbox',
        text: 'Работы на проверку',
        count: homework?.toReview ?? 0,
        link: '/teacher/homework/review',
      },
      {
        icon: 'pi pi-clock',
        text: 'Просроченные задания',
        count: homework?.overdue ?? 0,
        link: '/teacher/homework',
      },
      {
        icon: 'pi pi-exclamation-triangle',
        text: 'Недоставленные уведомления',
        count: notifications?.failedDeliveries ?? 0,
        link: '/teacher/notifications',
        query: { tab: 'students' },
      },
    ];
    return items.filter((item) => item.count > 0);
  });
}
