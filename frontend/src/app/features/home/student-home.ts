import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { HelpButton } from '@features/help/parts';
import { BillingApi, MyBalanceWidget } from '@features/billing/parts';
import { MyBoardsCard } from '@features/boards/parts';
import type { MyBillingSummary } from '@features/billing/parts';
import { HomeworkApi, MyDeadlinesWidget } from '@features/homework/parts';
import type { MyHomeworkSummary } from '@features/homework/parts';
import { ConnectMessengerCard, LatestNotificationsWidget } from '@features/notifications/parts';
import { NextLessonWidget, ScheduleApi } from '@features/schedule/parts';
import type { MyScheduleSummary } from '@features/schedule/parts';
import { StudentWelcomeCard } from './student-welcome-card';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';

/**
 * Student personal area dashboard: the nearest lesson with its link on top, then the widgets of the
 * modules one under another (ADR-0021): homework, balance, notifications, boards.
 */
@Component({
  selector: 'tb-student-home',
  imports: [
    HelpButton,
    ConnectMessengerCard,
    LatestNotificationsWidget,
    MyBalanceWidget,
    MyBoardsCard,
    MyDeadlinesWidget,
    NextLessonWidget,
    StudentWelcomeCard,
    LoadStateView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Личный кабинет">
      <tb-help-button help topic="cabinet/lesson" />
    </tb-page-header>
    <div class="tb-stack">
      @if (state.ready()) {
        @if (schedule(); as schedule) {
          <tb-next-lesson-widget [summary]="schedule" (changed)="loadSchedule()" />
        }
      } @else {
        <tb-load-state [state]="state" what="занятия, задания и баланс" (retry)="load()" />
      }
      <tb-student-welcome-card />
      <tb-connect-messenger-card />
      @if (homework(); as homework) {
        <tb-my-deadlines-widget [summary]="homework" />
      }
      @if (billing(); as billing) {
        <tb-my-balance-widget [summary]="billing" />
      }
      <tb-latest-notifications-widget link="/cabinet/notifications" />
      <tb-my-boards-card />
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
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    forkJoin({
      schedule: this.scheduleApi.mySummary(),
      homework: this.homeworkApi.mySummary(),
      billing: this.billingApi.mySummary(),
    })
      .pipe(this.state.track())
      .subscribe(({ schedule, homework, billing }) => {
        this.schedule.set(schedule);
        this.homework.set(homework);
        this.billing.set(billing);
      });
  }

  /** Reloads the nearest lesson (e.g. after a request was sent). */
  loadSchedule(): void {
    this.scheduleApi
      .mySummary()
      .pipe(this.state.track())
      .subscribe((summary) => {
        this.schedule.set(summary);
      });
  }
}
