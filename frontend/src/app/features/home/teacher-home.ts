import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { HelpButton } from '@features/help/parts';
import { BillingApi, FinanceWidget } from '@features/billing/parts';
import type { BillingSummary } from '@features/billing/parts';
import { HomeworkApi } from '@features/homework/parts';
import type { HomeworkSummary } from '@features/homework/parts';
import { LatestNotificationsWidget, NotificationsApi } from '@features/notifications/parts';
import type { TeacherNotificationsSummary } from '@features/notifications/parts';
import { ScheduleApi, TodayLessonsWidget, UpcomingLessonWidget } from '@features/schedule/parts';
import type { ScheduleSummary } from '@features/schedule/parts';
import { AttentionCard } from './attention-card';
import { FirstRunChecklist, SetupProgress } from './first-run-checklist';
import { QuickActions } from './quick-actions';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';

/**
 * Teacher dashboard: quick actions, the next lesson on top, then the widgets of the modules one under
 * another (ADR-0021): today's lessons, what needs attention, notifications, finance.
 */
@Component({
  selector: 'tb-teacher-home',
  imports: [
    HelpButton,
    AttentionCard,
    FinanceWidget,
    FirstRunChecklist,
    LatestNotificationsWidget,
    QuickActions,
    TodayLessonsWidget,
    UpcomingLessonWidget,
    LoadStateView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Главная">
      <tb-help-button help topic="teacher/first-steps" />
    </tb-page-header>
    <div class="tb-stack">
      <tb-quick-actions />
      @if (!state.ready()) {
        <tb-load-state
          [state]="state"
          what="занятия, задания, уведомления и финансы"
          (retry)="load()"
        />
      }
      @if (schedule()?.next; as next) {
        <tb-upcoming-lesson-widget [lesson]="next" />
      }
      <tb-first-run-checklist [progress]="progress()" />
      @if (schedule(); as schedule) {
        <tb-today-lessons-widget [summary]="schedule" (changed)="loadSchedule()" />
      }
      @if (schedule() !== null && homework() !== null && notifications() !== null) {
        <tb-attention-card
          [schedule]="schedule()"
          [homework]="homework()"
          [notifications]="notifications()"
        />
      }
      <tb-latest-notifications-widget link="/teacher/notifications" />
      @if (billing(); as billing) {
        <tb-finance-widget [summary]="billing" />
      }
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

  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    forkJoin({
      schedule: this.scheduleApi.summary(),
      homework: this.homeworkApi.summary(),
      billing: this.billingApi.summary(),
      notifications: this.notificationsApi.summary(),
    })
      .pipe(this.state.track())
      .subscribe(({ schedule, homework, billing, notifications }) => {
        this.schedule.set(schedule);
        this.homework.set(homework);
        this.billing.set(billing);
        this.notifications.set(notifications);
      });
  }

  /** Reloads the schedule counters (e.g. after a lesson was marked). */
  loadSchedule(): void {
    this.scheduleApi
      .summary()
      .pipe(this.state.track())
      .subscribe((summary) => {
        this.schedule.set(summary);
      });
  }
}
