import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { injectWindowSize } from '@core/layout/mobile';
import { MyBoardsFeed } from '@features/boards/parts';
import { HelpButton } from '@features/help/parts';
import { BillingApi, MyBalanceWidget } from '@features/billing/parts';
import type { MyBillingSummary } from '@features/billing/parts';
import { HomeworkApi, MyDeadlinesWidget } from '@features/homework/parts';
import type { MyHomeworkSummary } from '@features/homework/parts';
import { ConnectMessengerCard } from '@features/notifications/parts';
import { NextLessonWidget, ScheduleApi, formatLessonStart } from '@features/schedule/parts';
import type { MyScheduleSummary } from '@features/schedule/parts';
import { MyTextbooksFeed } from '@features/textbooks/parts';
import { StudentWelcomeCard } from './student-welcome-card';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { T } from './i18n/texts';

/** Cards of the lesson's materials per kind on the home page: a board and a textbook side by side (ours). */
const MATERIALS = 1;

/**
 * Student's home (spec §10.4): a feed of two columns — the nearest lesson (hero), «Сдать» and «Проверено недавно»;
 * on the right «Оплачено N занятий» and the materials. Narrower than the expanded size: one column in the same order.
 */
@Component({
  selector: 'tb-student-home',
  imports: [
    HelpButton,
    ConnectMessengerCard,
    MyBalanceWidget,
    MyBoardsFeed,
    MyDeadlinesWidget,
    MyTextbooksFeed,
    NextLessonWidget,
    StudentWelcomeCard,
    LoadStateView,
    PageHeader,
    Pane,
    Panes,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <tb-page-header tbPaneHeader [title]="greeting()">
          <tb-help-button help topic="cabinet/lesson" />
          @if (summaryLine(); as line) {
            <span meta class="tb-muted">{{ line }}</span>
          }
        </tb-page-header>
        <div class="tb-feed" [class.tb-feed--2]="twoColumns()">
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
              <tb-next-lesson-widget [summary]="schedule" (changed)="loadSchedule()" />
            }
            @if (homework(); as homework) {
              <tb-my-deadlines-widget [summary]="homework" />
            }
            <tb-student-welcome-card />
            <tb-connect-messenger-card />
          </div>
          <div class="tb-stack tb-feed__side">
            @if (billing(); as billing) {
              <tb-my-balance-widget [summary]="billing" />
            }
            <section class="tb-feed__materials" [hidden]="materialsTotal() === 0">
              <h2 class="tb-feed__title">{{ t.materials }}</h2>
              <tb-my-boards-feed [limit]="cards" />
              <tb-my-textbooks-feed [limit]="cards" />
            </section>
          </div>
        </div>
      </tb-pane>
    </tb-panes>
  `,
  styles: `
    .tb-feed {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-6) var(--tb-space-8);
      align-items: start;
    }

    .tb-feed--2 {
      grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
    }

    .tb-feed__state {
      grid-column: 1 / -1;
    }

    .tb-feed__lead:empty,
    .tb-feed__side:empty {
      display: none;
    }

    .tb-feed__materials {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--tb-space-3);
    }

    .tb-feed__materials[hidden] {
      display: none;
    }

    .tb-feed__title {
      grid-column: 1 / -1;
      margin: 0;
      font: var(--tb-type-title-m);
    }

    /* each feed gives one card: the grid of the feed is one column here */
    .tb-feed__materials ::ng-deep .tb-material-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
})
export class StudentHome implements OnInit {
  protected readonly t = T.studentHome;
  protected readonly cards = MATERIALS;
  private readonly scheduleApi = inject(ScheduleApi);
  private readonly homeworkApi = inject(HomeworkApi);
  private readonly billingApi = inject(BillingApi);
  private readonly auth = inject(AuthService);
  private readonly size = injectWindowSize();

  protected readonly schedule = signal<MyScheduleSummary | null>(null);
  protected readonly homework = signal<MyHomeworkSummary | null>(null);
  protected readonly billing = signal<MyBillingSummary | null>(null);
  protected readonly state = new LoadState();

  private readonly boards = viewChild(MyBoardsFeed);
  private readonly textbooks = viewChild(MyTextbooksFeed);
  protected readonly materialsTotal = computed(
    () => (this.boards()?.total() ?? 0) + (this.textbooks()?.total() ?? 0),
  );

  protected readonly twoColumns = computed(() => {
    const size = this.size();
    return size !== 'compact' && size !== 'medium';
  });

  /** «Привет, Анна»: the first word of the name. */
  protected readonly greeting = computed(() =>
    this.t.hello((this.auth.user()?.displayName ?? '').trim().split(/\s+/)[0] ?? ''),
  );

  /** «Следующее занятие: чт, 01.10, 18:00 · Заданий к сдаче: 2»: only the parts there are. */
  protected readonly summaryLine = computed(() => {
    const next = this.schedule()?.next;
    const homework = this.homework();
    return [
      next ? this.t.next(formatLessonStart(next.startsAt)) : '',
      homework && homework.open > 0 ? this.t.toHandIn(homework.open) : '',
    ]
      .filter((part) => part !== '')
      .join(' · ');
  });

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
