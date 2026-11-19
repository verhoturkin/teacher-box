import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { locale } from '@core/i18n/language';
import { CORE_T } from '@core/i18n/texts';
import { injectCreateItems } from '@core/layout/create-menu';
import { injectMobile, injectWindowSize } from '@core/layout/mobile';
import { HelpButton } from '@features/help/parts';
import { BillingApi, FinanceWidget } from '@features/billing/parts';
import type { BillingSummary } from '@features/billing/parts';
import { HomeworkApi } from '@features/homework/parts';
import type { HomeworkSummary } from '@features/homework/parts';
import { NotificationsApi, PushOnboardingCard } from '@features/notifications/parts';
import type { TeacherNotificationsSummary } from '@features/notifications/parts';
import { ScheduleApi } from '@features/schedule/parts';
import type { ScheduleSummary } from '@features/schedule/parts';
import { FabMenu } from '@shared/ui/fab-menu';
import { Pane, Panes } from '@shared/ui/panes';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { T } from './i18n/texts';
import { SetupProgress, TodoQueue } from './todo-queue';
import { TodayLessons } from './today-lessons';
import { WeekFigures, WeekFiguresCard } from './week-figures';

const DAY = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

/** The date in the header: the first letter capital («Понедельник, 19 октября»). */
function dayTitle(date: Date): string {
  const text = DAY.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Teacher's «Сегодня» (spec §6): the feed in three columns (extra-large), two (large) or one — the lessons
 * of today with the nearest one expanded, the queue («Отметить занятия», «Проверить работы»), the month and the week figures. On a phone the same sections follow one another.
 */
@Component({
  selector: 'tb-teacher-home',
  imports: [
    HelpButton,
    FabMenu,
    FinanceWidget,
    LoadStateView,
    Pane,
    PageHeader,
    Panes,
    PushOnboardingCard,
    TodoQueue,
    TodayLessons,
    WeekFiguresCard,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <tb-page-header tbPaneHeader [title]="today()">
          <tb-help-button help topic="teacher/first-steps" />
          @if (!mobile() && summaryLine(); as line) {
            <span meta class="tb-muted">{{ line }}</span>
          }
        </tb-page-header>
        <div class="tb-feed" [class]="'tb-feed--' + columns()">
          @if (!state.ready()) {
            <tb-load-state
              class="tb-feed__state"
              [state]="state"
              [what]="t.what"
              (retry)="load()"
            />
          }
          <div class="tb-stack tb-feed__lead">
            @if (schedule(); as schedule) {
              @if (schedule.today.length > 0 || schedule.next !== null) {
                <tb-today-lessons
                  [all]="schedule.today"
                  [next]="schedule.next"
                  (over)="loadSchedule()"
                />
              }
            }
            <tb-push-onboarding-card [teacher]="true" />
          </div>
          <div class="tb-stack tb-feed__queue">
            @if (state.error() === null) {
              <tb-todo-queue [progress]="progress()" (marked)="loadSchedule()" />
            }
          </div>
          <div class="tb-stack tb-feed__figures">
            @if (billing(); as billing) {
              <tb-finance-widget [summary]="billing" />
            }
            @if (weekFigures(); as week) {
              <tb-week-figures [figures]="week" />
            }
          </div>
        </div>
      </tb-pane>
    </tb-panes>
    <!-- on a phone the home page's FAB is «Создать»; wider it is in the rail (spec §3.1) -->
    @if (mobile()) {
      <tb-fab-menu [items]="createItems" [label]="createLabel" />
    }
  `,
  styles: `
    .tb-feed {
      display: grid;
      gap: var(--tb-gap-section);
      align-items: start;
    }

    /*
     * From large (sketch «Главная учителя», variant B): the figures across the top, the lessons and the queue
     * below in two equal columns
     */
    .tb-feed--2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));

      .tb-feed__figures {
        grid-column: 1 / -1;
        grid-row: 1;
        flex-direction: row;

        /* the month's two figures and the week's four: one row of tiles of about one width */
        > tb-finance-widget {
          flex: 2 1 0;
          min-width: 0;
        }

        > tb-week-figures {
          flex: 4 1 0;
          min-width: 0;
        }
      }
    }

    .tb-feed--1 {
      grid-template-columns: minmax(0, 1fr);
    }

    .tb-feed__state {
      grid-column: 1 / -1;
    }

    .tb-feed__lead:empty,
    .tb-feed__queue:empty,
    .tb-feed__figures:empty {
      display: none;
    }
  `,
})
export class TeacherHome implements OnInit {
  protected readonly t = T.teacherHome;
  /** «Понедельник, 19 октября»: the page says which day it is about (spec §6). */
  protected readonly today = signal(dayTitle(new Date()));
  protected readonly mobile = injectMobile();
  private readonly size = injectWindowSize();
  /** Columns of the feed (spec §6): the figures across and two equal columns from large, else 1. */
  protected readonly columns = computed(() =>
    this.size() === 'large' || this.size() === 'extra-large' ? 2 : 1,
  );
  protected readonly createItems = injectCreateItems()('/teacher');
  protected readonly createLabel = CORE_T.create.title;
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly billingApi = inject(BillingApi);
  private readonly homeworkApi = inject(HomeworkApi);
  private readonly notificationsApi = inject(NotificationsApi);

  protected readonly schedule = signal<ScheduleSummary | null>(null);
  protected readonly billing = signal<BillingSummary | null>(null);
  protected readonly homework = signal<HomeworkSummary | null>(null);
  protected readonly notifications = signal<TeacherNotificationsSummary | null>(null);
  protected readonly progress = computed<SetupProgress>(() => {
    const notifications = this.notifications();
    return {
      hasStudents: notifications === null ? null : notifications.students > 0,
      messengerConfigured: notifications?.messengerConfigured ?? null,
      hasLessons: this.schedule()?.hasLessons ?? null,
    };
  });

  protected readonly weekFigures = computed<WeekFigures | null>(() => {
    const schedule = this.schedule();
    const homework = this.homework();
    if (schedule === null || homework === null) {
      return null;
    }
    return {
      conducted: schedule.weekConducted,
      missed: schedule.weekMissed,
      assigned: homework.weekAssigned,
      onTime: homework.weekOnTime,
    };
  });

  /** «4 занятия · 2 работы на проверку · 1 запрос»: only the non-zero parts. */
  protected readonly summaryLine = computed(() => {
    const schedule = this.schedule();
    const homework = this.homework();
    if (schedule === null || homework === null) {
      return '';
    }
    const lessons = schedule.today.filter((lesson) => lesson.status !== 'CANCELLED').length;
    const parts = [
      lessons > 0 ? this.t.lessons(lessons) : '',
      homework.toReview > 0 ? this.t.reviews(homework.toReview) : '',
      schedule.pendingRequests > 0 ? this.t.requests(schedule.pendingRequests) : '',
    ];
    return parts.filter((part) => part !== '').join(' · ');
  });

  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    forkJoin({
      schedule: this.scheduleApi.summary(),
      billing: this.billingApi.summary(),
      homework: this.homeworkApi.summary(),
      notifications: this.notificationsApi.summary(),
    })
      .pipe(this.state.track())
      .subscribe(({ schedule, billing, homework, notifications }) => {
        this.schedule.set(schedule);
        this.billing.set(billing);
        this.homework.set(homework);
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
