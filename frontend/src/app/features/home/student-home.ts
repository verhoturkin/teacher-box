import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { BillingApi, MyBalanceWidget } from '@features/billing/parts';
import type { MyBillingSummary } from '@features/billing/parts';
import { HomeworkApi, MyDeadlinesWidget } from '@features/homework/parts';
import type { MyHomeworkSummary } from '@features/homework/parts';
import { ConnectMessengerCard, LatestNotificationsWidget } from '@features/notifications/parts';
import { NextLessonWidget, ScheduleApi } from '@features/schedule/parts';
import type { MyScheduleSummary } from '@features/schedule/parts';

/** Student personal area dashboard: collects the widgets of the modules. */
@Component({
  selector: 'tb-student-home',
  imports: [ConnectMessengerCard, LatestNotificationsWidget, MyBalanceWidget, MyDeadlinesWidget, NextLessonWidget],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Личный кабинет</h1>
    <div class="tb-stack">
      <tb-connect-messenger-card />
      <div class="tb-home">
        <div class="tb-stack">
          @if (schedule(); as schedule) {
            <tb-next-lesson-widget [summary]="schedule" (changed)="loadSchedule()" />
          }
          @if (homework(); as homework) {
            <tb-my-deadlines-widget [summary]="homework" />
          }
        </div>
        <div class="tb-stack">
          @if (billing(); as billing) {
            <tb-my-balance-widget [summary]="billing" />
          }
          <tb-latest-notifications-widget link="/cabinet/notifications" />
        </div>
      </div>
    </div>
  `,
})
export class StudentHome implements OnInit {
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly homeworkApi = inject(HomeworkApi);
  private readonly billingApi = inject(BillingApi);

  protected readonly schedule = signal<MyScheduleSummary | null>(null);
  protected readonly homework = signal<MyHomeworkSummary | null>(null);
  protected readonly billing = signal<MyBillingSummary | null>(null);

  ngOnInit(): void {
    this.loadSchedule();
    this.homeworkApi.mySummary().subscribe((summary) => {
      this.homework.set(summary);
    });
    this.billingApi.mySummary().subscribe((summary) => {
      this.billing.set(summary);
    });
  }

  /** Reloads the nearest lesson (e.g. after a request was sent). */
  loadSchedule(): void {
    this.scheduleApi.mySummary().subscribe((summary) => {
      this.schedule.set(summary);
    });
  }
}
