import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';
import { Button } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';
import { injectMobile } from '@core/layout/mobile';
import { HelpButton } from '@features/help/parts';
import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import { ScheduleApi } from '../data-access/schedule-api';
import {
  BusyTime,
  ChangeKind,
  ChangeRequest,
  ScheduleSettings,
  ScheduledLesson,
} from '../data-access/schedule.models';
import {
  REQUEST_STATUS_LABELS,
  formatLessonStart,
  formatLessonTime,
  requestKindLabel,
  widen,
} from '../schedule-labels';
import { CalendarFeedPanel } from '../ui/calendar-feed-panel';
import { LessonActions } from '../ui/lesson-actions';
import { CalendarRange, CalendarView, ScheduleCalendar } from '../ui/schedule-calendar';
import { MiniMonth } from '../ui/mini-month';
import { ScheduleAgenda, weekStart, weekDays } from '../ui/schedule-agenda';
import { Pane, Panes } from '@shared/ui/panes';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { ChangeRequestDialog } from './change-request-dialog';
import { LessonSummary, excusedFrom } from './lesson-summary';
import { EmptyState } from '@shared/ui/empty-state';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { RowType } from '@shared/ui/row-type.directive';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** The day after the end of the week of `date` (Monday; the week starts on Monday). */
export function nextMonday(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() + 7 - ((monday.getDay() + 6) % 7));
  return monday;
}

/**
 * The student's schedule follows the teacher's panes: calendar, with upcoming lessons, requests
 * and a subscription beside it. Compact uses the shared agenda and opens lesson actions in a sheet.
 */
@Component({
  selector: 'tb-my-schedule-page',
  imports: [
    NgTemplateOutlet,
    ButtonAttributes,
    RowType,
    LessonSummary,
    EmptyState,
    HelpButton,
    Button,
    Pane,
    Panes,
    MiniMonth,
    ScheduleAgenda,
    FilterChips,
    Drawer,
    Dialog,
    Tag,
    CalendarFeedPanel,
    ChangeRequestDialog,
    LessonActions,
    ScheduleCalendar,
    ModalDrawer,
    LoadStateView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      <tb-pane [label]="t.title">
        <tb-page-header tbPaneHeader [title]="t.title">
          <tb-help-button help topic="cabinet/schedule" />
        </tb-page-header>
        @if (mobile()) {
          <tb-filter-chips
            [label]="page.screens"
            [chips]="screens()"
            [value]="screen()"
            (valueChange)="selectScreen($event)"
          />
        }
        @if (mobile() && screen() === 'agenda') {
          <tb-schedule-agenda
            [lessons]="calendarLessons()"
            [loaded]="calendarState.ready()"
            [showStudent]="false"
            [day]="currentDay()"
            (dayChange)="selectDay($event)"
            (lessonClick)="openSheet($event)"
          />
          @if (calendarState.status() === 'error') {
            <tb-load-state
              [state]="calendarState"
              [what]="t.whatCalendar"
              [compact]="true"
              (retry)="loadCalendar()"
            />
          }
        } @else {
          @if (calendarState.status() === 'error') {
            <tb-load-state
              [state]="calendarState"
              [what]="t.whatCalendar"
              [compact]="true"
              (retry)="loadCalendar()"
            />
          }
          <!-- FullCalendar reads initialView at creation; each compact screen gets its own view. -->
          @for (view of [screen()]; track view) {
            <tb-schedule-calendar
              [lessons]="calendarLessons()"
              [busy]="busy()"
              [busyTitle]="t.busy"
              [showStudent]="false"
              [focusDate]="focusDate()"
              [initialDate]="currentDay()"
              [phoneView]="phoneView()"
              (lessonClick)="openSheet($event)"
              [loaded]="calendarState.ready()"
              (rangeChange)="onRange($event)"
            />
          }
        }
      </tb-pane>
      <tb-pane kind="fixed" class="tb-my-schedule-side" [label]="t.upcoming">
        @if (!mobile()) {
          <tb-mini-month
            tbPaneHeader
            [current]="currentDay()"
            [marked]="lessonDays()"
            (dateSelect)="focusDate.set($event)"
          />
        }
        <div class="tb-stack">
          <section class="tb-my-schedule-section">
            <h2>{{ t.upcoming }}</h2>
            <tb-load-state [state]="upcomingState" [what]="t.whatUpcoming" (retry)="reload()">
              @if (upcoming().length === 0) {
                <tb-empty-state
                  icon="tb-i-calendar_month"
                  [title]="t.noMoreTitle"
                  [hint]="t.noMoreHint"
                />
              } @else {
                <ul class="tb-list tb-list--no-phone-lead tb-schedule-list">
                  @for (lesson of upcoming(); track lesson.id) {
                    <li [class.tb-list__item--link]="mobile()">
                      <span class="tb-list__lead" aria-hidden="true">
                        <i [class]="leadIcon(lesson)"></i>
                      </span>
                      <div class="tb-list__text">
                        <span class="tb-list__title">{{ time(lesson) }}</span>
                        <tb-lesson-summary [lesson]="lesson" />
                      </div>
                      @if (mobile()) {
                        <!-- a phone: the row stays one line, its actions are in the bottom sheet -->
                        <div class="tb-list__trail tb-list__trail--icons">
                          <!-- stretched over the row: the whole row opens the sheet -->
                          <p-button
                            class="tb-list__stretched"
                            icon="tb-i tb-i-chevron_right"
                            severity="secondary"
                            [text]="true"
                            [rounded]="true"
                            [ariaLabel]="t.lesson(time(lesson))"
                            (onClick)="openSheet(lesson)"
                          />
                        </div>
                      } @else {
                        <div class="tb-list__trail">
                          <tb-lesson-actions
                            [stacked]="true"
                            [joinUrl]="joinUrl(lesson)"
                            [requests]="canAsk(lesson)"
                            [group]="lesson.groupId !== null"
                            (ask)="ask(lesson, $event)"
                          />
                          @if (lesson.pendingRequests[0]; as request) {
                            <p-button
                              severity="danger"
                              [label]="t.withdraw"
                              [text]="true"
                              [ariaLabel]="t.withdrawOf(time(lesson))"
                              [loading]="actions.is('withdraw-' + request.id)"
                              (onClick)="withdraw(request)"
                            />
                          }
                        </div>
                      }
                    </li>
                  }
                </ul>
              }
            </tb-load-state>
          </section>

          @if (requests().length > 0) {
            <section class="tb-my-schedule-section">
              <h2>{{ t.requests }}</h2>
              @if (pendingRequests().length > 0) {
                <ul class="tb-list tb-list--no-phone-lead tb-schedule-list">
                  @for (request of pendingRequests(); track request.id) {
                    <ng-container *ngTemplateOutlet="requestRow; context: { $implicit: request }" />
                  }
                </ul>
              } @else {
                <p class="tb-muted">{{ t.noPendingRequests }}</p>
              }
              @if (resolvedRequests().length > 0) {
                <div class="tb-requests-resolved">
                  <p-button
                    [label]="t.resolvedRequests(resolvedRequests().length)"
                    [icon]="resolvedOpen() ? 'tb-i tb-i-expand_less' : 'tb-i tb-i-expand_more'"
                    iconPos="right"
                    [text]="true"
                    severity="secondary"
                    [tbAttributes]="{
                      'aria-expanded': resolvedOpen() ? 'true' : 'false',
                      'aria-controls': 'tb-requests-resolved',
                    }"
                    (onClick)="resolvedOpen.update((open) => !open)"
                  />
                  <div id="tb-requests-resolved" role="region" [attr.aria-label]="t.resolved">
                    @if (resolvedOpen()) {
                      <ul class="tb-list tb-list--no-phone-lead tb-schedule-list">
                        @for (request of resolvedRequests(); track request.id) {
                          <ng-container
                            *ngTemplateOutlet="requestRow; context: { $implicit: request }"
                          />
                        }
                      </ul>
                    }
                  </div>
                </div>
              }
            </section>
          }

          <ng-template #requestRow let-request [tbRowType]="requests()">
            <li>
              <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-forum"></i></span>
              <div class="tb-list__text">
                <span class="tb-list__title">
                  {{ kind(request) }}: {{ start(request.lessonStartsAt) }}
                  @if (request.groupName !== null) {
                    · {{ t.group(request.groupName) }}
                  }
                </span>
                @if (request.answer !== null) {
                  <span class="tb-list__supporting">{{ t.teacher(request.answer) }}</span>
                }
              </div>
              <div class="tb-list__trail">
                <p-tag
                  [value]="requestStatuses[request.status].label"
                  [severity]="requestStatuses[request.status].severity"
                />
              </div>
            </li>
          </ng-template>
          <tb-calendar-feed-panel class="tb-my-schedule-feed" />
        </div>
      </tb-pane>
    </tb-panes>

    @if (mobile()) {
      <p-drawer
        tbModalDrawer
        [blockScroll]="true"
        [ariaCloseLabel]="c.close"
        [visible]="sheetLesson() !== null"
        (visibleChange)="$event || closeSheet()"
        position="bottom"
        styleClass="tb-sheet"
        [header]="sheetTitle()"
      >
        <ng-container *ngTemplateOutlet="lessonDetails" />
      </p-drawer>
    } @else {
      <p-dialog
        [visible]="sheetLesson() !== null"
        (visibleChange)="$event || closeSheet()"
        [modal]="true"
        [draggable]="false"
        [closeAriaLabel]="c.close"
        styleClass="tb-dialog"
        [header]="sheetTitle()"
      >
        <ng-container *ngTemplateOutlet="lessonDetails" />
      </p-dialog>
    }
    <ng-template #lessonDetails>
      @if (sheetLesson(); as lesson) {
        <div class="tb-list__text">
          <tb-lesson-summary [lesson]="lesson" />
        </div>
        <tb-lesson-actions
          [stacked]="true"
          [joinUrl]="joinUrl(lesson)"
          [requests]="canAsk(lesson)"
          [group]="lesson.groupId !== null"
          rescheduleIcon="tb-i tb-i-calendar_month"
          (ask)="closeSheet(); ask(lesson, $event)"
        />
        @if (lesson.pendingRequests[0]; as request) {
          <p-button
            severity="secondary"
            [label]="t.withdrawRequest"
            icon="tb-i tb-i-undo"
            [fluid]="true"
            [loading]="actions.is('withdraw-' + request.id)"
            (onClick)="withdraw(request)"
          />
        }
      }
    </ng-template>

    <tb-change-request-dialog
      [(visible)]="requestVisible"
      [lesson]="requestLesson()"
      [kind]="requestKind()"
      [lateCancellationMinutes]="settings()?.lateCancellationMinutes ?? 0"
      [now]="now()"
      (sent)="onSent()"
    />
  `,
  styles: `
    :host ::ng-deep .tb-my-schedule-feed .p-card-body {
      padding: 0;
    }

    @media (width < 37.5em) {
      :host ::ng-deep .tb-my-schedule-side {
        background: transparent;
      }

      .tb-my-schedule-section,
      .tb-my-schedule-feed {
        display: block;
        padding: var(--tb-space-4);
        border-radius: var(--tb-shape-lg);
        background: var(--p-md-surface-container-low);
      }
    }

    .tb-schedule-list > li:has(> .tb-list__trail:not(.tb-list__trail--icons) tb-lesson-actions) {
      grid-template-areas: 'lead text text' 'trail trail trail';
    }

    .tb-schedule-list > li > .tb-list__trail:not(.tb-list__trail--icons) {
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    :host ::ng-deep .tb-my-schedule-side {
      @media (width >= 37.5em) {
        background: var(--p-md-surface-container-low);
      }
      --tb-list-item: var(--p-md-surface-container-lowest);
    }

    :host-context(.tb-dark) ::ng-deep .tb-my-schedule-side {
      --tb-list-item: var(--p-md-surface-container-high);
    }

    :host ::ng-deep .tb-my-schedule-side .tb-pane__scroll {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }

    tb-filter-chips {
      margin-block-end: var(--tb-space-4);
    }

    .tb-my-schedule-section h2 {
      margin: 0 0 var(--tb-space-3);
      font: var(--tb-type-title-m-emphasized);
    }

    /* «Решённые»: apart from the pending ones, without a line */
    .tb-requests-resolved {
      margin-top: var(--tb-space-3);
    }

    /* the opened list keeps its distance from the button */
    #tb-requests-resolved:not(:empty) {
      margin-top: var(--tb-space-2);
    }
  `,
})
export class MySchedulePage implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.mine;
  protected readonly page = T.page;
  protected readonly screen = signal('agenda');
  protected readonly screens = computed<readonly FilterChip<string>[]>(() => [
    { value: 'agenda', label: T.page.screenAgenda },
    { value: 'week', label: T.page.screenWeek },
    { value: 'month', label: T.page.screenMonth },
  ]);
  protected readonly phoneView = computed<CalendarView | null>(() =>
    this.screen() === 'month' ? 'dayGridMonth' : 'timeGridWeek',
  );
  protected readonly currentDay = signal(toIsoDate(new Date()));
  protected readonly focusDate = signal<string | null>(null);
  protected readonly lessonDays = computed(
    () => new Set(this.calendarLessons().map((lesson) => toIsoDate(new Date(lesson.startsAt)))),
  );
  protected readonly actions = new Busy();
  private readonly api = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly kind = requestKindLabel;
  protected readonly requestStatuses = REQUEST_STATUS_LABELS;
  protected readonly settings = signal<ScheduleSettings | null>(null);
  protected readonly upcomingLessons = signal<ScheduledLesson[]>([]);
  protected readonly calendarLessons = signal<ScheduledLesson[]>([]);
  protected readonly busy = signal<BusyTime[]>([]);
  protected readonly requests = signal<ChangeRequest[]>([]);
  /** Waiting for the teacher's answer: always shown. */
  protected readonly pendingRequests = computed(() =>
    this.requests().filter((request) => request.status === 'PENDING'),
  );
  /** Approved, declined, withdrawn or outdated: under «Решённые», folded. */
  protected readonly resolvedRequests = computed(() =>
    this.requests().filter((request) => request.status !== 'PENDING'),
  );
  protected readonly resolvedOpen = signal(false);
  protected readonly now = signal(new Date());
  protected readonly upcoming = computed(() =>
    this.upcomingLessons().filter((lesson) => new Date(lesson.endsAt) > this.now()),
  );

  protected readonly mobile = injectMobile();
  /** The lesson whose detail dialog (bottom sheet on compact) is open. */
  protected readonly sheetLesson = signal<ScheduledLesson | null>(null);
  protected readonly sheetTitle = computed(() => {
    const lesson = this.sheetLesson();
    return lesson === null ? '' : this.time(lesson);
  });

  protected readonly requestVisible = signal(false);
  protected readonly requestLesson = signal<ScheduledLesson | null>(null);
  protected readonly requestKind = signal<ChangeKind>('RESCHEDULE');

  protected readonly upcomingState = new LoadState();
  protected readonly calendarState = new LoadState();

  private range: CalendarRange | null = null;

  ngOnInit(): void {
    if (this.mobile()) this.selectDay(this.currentDay());
    this.reload();
  }

  onRange(range: CalendarRange): void {
    this.currentDay.set(range.current);
    this.range = range;
    this.loadCalendar();
  }

  protected selectScreen(screen: string): void {
    this.screen.set(screen);
    if (screen === 'agenda') this.selectDay(this.currentDay());
  }

  protected selectDay(day: string): void {
    this.currentDay.set(day);
    const from = weekStart(day);
    const last = weekDays(from)[6] ?? from;
    this.range = { from, to: toIsoDate(nextMonday(fromIsoDate(last))), current: day };
    this.loadCalendar();
  }

  /** The student said they would not come to this group lesson. */
  protected excused(lesson: ScheduledLesson): boolean {
    return excusedFrom(lesson);
  }

  ask(lesson: ScheduledLesson, kind: ChangeKind): void {
    this.now.set(new Date());
    this.requestLesson.set(lesson);
    this.requestKind.set(kind);
    this.requestVisible.set(true);
  }

  openSheet(lesson: ScheduledLesson): void {
    this.sheetLesson.set(lesson);
  }

  closeSheet(): void {
    this.sheetLesson.set(null);
  }

  /** A lesson with a meeting shows the camera, a group lesson the people. */
  protected leadIcon(lesson: ScheduledLesson): string {
    if (this.joinUrl(lesson) !== null) {
      return 'tb-i tb-i-videocam';
    }
    return lesson.groupId === null ? 'tb-i tb-i-calendar_month' : 'tb-i tb-i-group';
  }

  /** The meeting of a lesson that is still planned. */
  protected joinUrl(lesson: ScheduledLesson): string | null {
    return lesson.status === 'SCHEDULED' ? lesson.joinUrl : null;
  }

  /** Whether the student may ask to move or cancel the lesson. */
  protected canAsk(lesson: ScheduledLesson): boolean {
    return (
      lesson.status === 'SCHEDULED' && lesson.pendingRequests.length === 0 && !this.excused(lesson)
    );
  }

  onSent(): void {
    this.snackbar.success(T.mine.sent);
    this.reload();
  }

  withdraw(request: ChangeRequest): void {
    this.actions.guard('withdraw-' + request.id, this.api.withdraw(request.id)).subscribe(() => {
      this.closeSheet();
      this.snackbar.success(T.mine.withdrawn);
      this.reload();
    });
  }

  protected time(lesson: ScheduledLesson): string {
    return formatLessonTime(lesson.startsAt, lesson.endsAt);
  }

  protected start(iso: string): string {
    return formatLessonStart(iso);
  }

  protected reload(): void {
    this.now.set(new Date());
    const today = this.now();
    forkJoin({
      settings: this.api.settings(),
      lessons: this.api.myLessons(toIsoDate(today), toIsoDate(nextMonday(today))),
      requests: this.api.myRequests(),
    })
      .pipe(this.upcomingState.track())
      .subscribe(({ settings, lessons, requests }) => {
        this.settings.set(settings);
        this.upcomingLessons.set(lessons);
        this.requests.set(requests);
      });
    this.loadCalendar();
  }

  protected loadCalendar(): void {
    const range = this.range;
    if (range === null) {
      return;
    }
    const widened = widen(range);
    forkJoin({
      lessons: this.api.myLessons(widened.from, widened.to),
      busy: this.api.teacherBusy(
        fromIsoDate(widened.from).toISOString(),
        fromIsoDate(widened.to).toISOString(),
      ),
    })
      .pipe(this.calendarState.track())
      .subscribe(({ lessons, busy }) => {
        this.calendarLessons.set(lessons);
        this.busy.set(busy);
      });
  }
}
