import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { BillingApi, FinanceWidget } from '@features/billing/parts';
import type { BillingSummary } from '@features/billing/parts';
import { HomeworkApi } from '@features/homework/parts';
import type { HomeworkSummary } from '@features/homework/parts';
import { LatestNotificationsWidget, NotificationsApi } from '@features/notifications/parts';
import type { TeacherNotificationsSummary } from '@features/notifications/parts';
import { ScheduleApi, TodayLessonsWidget } from '@features/schedule/parts';
import type { ScheduleSummary } from '@features/schedule/parts';
import { AttentionCard } from './attention-card';
import { FirstRunChecklist, SetupProgress } from './first-run-checklist';

/** Teacher dashboard: collects the widgets of the modules. */
@Component({
  selector: 'tb-teacher-home',
  imports: [AttentionCard, FinanceWidget, FirstRunChecklist, LatestNotificationsWidget, TodayLessonsWidget],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Главная</h1>
    <div class="tb-stack">
      <tb-first-run-checklist [progress]="progress()" />
      <div class="tb-home">
        <div class="tb-stack">
          @if (schedule(); as schedule) {
            <tb-today-lessons-widget [summary]="schedule" (changed)="loadSchedule()" />
          }
          <tb-latest-notifications-widget link="/teacher/notifications" />
        </div>
        <div class="tb-stack">
          @if (schedule() !== null && homework() !== null && notifications() !== null) {
            <tb-attention-card [schedule]="schedule()" [homework]="homework()" [notifications]="notifications()" />
          }
          @if (billing(); as billing) {
            <tb-finance-widget [summary]="billing" />
          }
        </div>
      </div>
    </div>
  `,
})
export class TeacherHome implements OnInit {
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly homeworkApi = inject(HomeworkApi);
  private readonly billingApi = inject(BillingApi);
  private readonly notificationsApi = inject(NotificationsApi);

  protected readonly schedule = signal<ScheduleSummary | null>(null);
  protected readonly homework = signal<HomeworkSummary | null>(null);
  protected readonly billing = signal<BillingSummary | null>(null);
  protected readonly notifications = signal<TeacherNotificationsSummary | null>(null);
  protected readonly progress = computed<SetupProgress>(() => {
    const notifications = this.notifications();
    return {
      hasStudents: notifications === null ? null : notifications.students > 0,
      priceSet: this.billing()?.priceSet ?? null,
      messengerConfigured: notifications?.messengerConfigured ?? null,
      hasLessons: this.schedule()?.hasLessons ?? null,
    };
  });

  ngOnInit(): void {
    this.loadSchedule();
    this.homeworkApi.summary().subscribe((summary) => {
      this.homework.set(summary);
    });
    this.billingApi.summary().subscribe((summary) => {
      this.billing.set(summary);
    });
    this.notificationsApi.summary().subscribe((summary) => {
      this.notifications.set(summary);
    });
  }

  /** Reloads the schedule counters (e.g. after a lesson was marked). */
  loadSchedule(): void {
    this.scheduleApi.summary().subscribe((summary) => {
      this.schedule.set(summary);
    });
  }
}
