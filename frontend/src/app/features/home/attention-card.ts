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
        <ul class="tb-attention">
          @for (item of items(); track item.text) {
            <li>
              <i [class]="item.icon" aria-hidden="true"></i>
              <a [routerLink]="item.link" [queryParams]="item.query" class="tb-link">{{ item.text }}</a>
              <span class="tb-attention__count">{{ item.count }}</span>
            </li>
          }
        </ul>
      }
    </p-card>
  `,
  styles: `
    .tb-attention {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        > i {
          color: var(--p-orange-500);
        }

        a {
          flex: 1;
        }
      }
    }

    .tb-attention__count {
      min-width: 1.75rem;
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      background: var(--p-orange-100);
      color: var(--p-orange-700);
      font-weight: 600;
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
      { icon: 'pi pi-inbox', text: 'Работы на проверку', count: homework?.toReview ?? 0, link: '/teacher/homework/review' },
      { icon: 'pi pi-clock', text: 'Просроченные задания', count: homework?.overdue ?? 0, link: '/teacher/homework' },
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
