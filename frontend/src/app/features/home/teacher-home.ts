import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { CORE_T } from '@core/i18n/texts';
import { createItems } from '@core/layout/create-menu';
import { injectMobile } from '@core/layout/mobile';
import { HelpButton } from '@features/help/parts';
import { BillingApi, FinanceWidget } from '@features/billing/parts';
import type { BillingSummary } from '@features/billing/parts';
import { HomeworkApi } from '@features/homework/parts';
import type { HomeworkSummary } from '@features/homework/parts';
import { NotificationsApi } from '@features/notifications/parts';
import type { TeacherNotificationsSummary } from '@features/notifications/parts';
import { ScheduleApi, UpcomingLessonWidget } from '@features/schedule/parts';
import type { ScheduleSummary } from '@features/schedule/parts';
import { AttentionCard } from './attention-card';
import { FirstRunChecklist, SetupProgress } from './first-run-checklist';
import { FabMenu } from '@shared/ui/fab-menu';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { T } from './i18n/texts';

/**
 * Teacher dashboard: the next lesson on top, then the widgets of the modules one under
 * another (ADR-0021): what needs attention, finance; the notifications are in the bell.
 */
@Component({
  selector: 'tb-teacher-home',
  imports: [
    HelpButton,
    AttentionCard,
    FabMenu,
    FinanceWidget,
    FirstRunChecklist,
    UpcomingLessonWidget,
    LoadStateView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="teacher/first-steps" />
    </tb-page-header>
    <div class="tb-stack">
      @if (!state.ready()) {
        <tb-load-state [state]="state" [what]="t.what" (retry)="load()" />
      }
      @if (schedule()?.next; as next) {
        <tb-upcoming-lesson-widget [lesson]="next" (over)="loadSchedule()" />
      }
      <tb-first-run-checklist [progress]="progress()" />
      @if (schedule() !== null && homework() !== null && notifications() !== null) {
        <tb-attention-card
          [schedule]="schedule()"
          [homework]="homework()"
          [notifications]="notifications()"
        />
      }
      @if (billing(); as billing) {
        <tb-finance-widget [summary]="billing" />
      }
    </div>
    <!-- on a phone the home page's FAB is «Создать»; wider it is in the rail (spec §3.1) -->
    @if (mobile()) {
      <tb-fab-menu [items]="createItems" [label]="createLabel" />
    }
  `,
})
export class TeacherHome implements OnInit {
  protected readonly t = T.teacherHome;
  protected readonly mobile = injectMobile();
  protected readonly createItems = createItems('/teacher');
  protected readonly createLabel = CORE_T.create.title;
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
