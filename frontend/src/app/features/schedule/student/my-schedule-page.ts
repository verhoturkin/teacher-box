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
import { Card } from 'primeng/card';
import { Drawer } from 'primeng/drawer';
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
import { CalendarRange, ScheduleCalendar } from '../ui/schedule-calendar';
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
 * The student's schedule, one card under another (ADR-0021): upcoming lessons of this week with the
 * link to the online lesson and requests to move or cancel them, the student's requests, the
 * calendar and the calendar link.
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
    Card,
    Drawer,
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
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="cabinet/schedule" />
    </tb-page-header>
    <div class="tb-stack">
      <p-card [header]="t.upcoming">
        <tb-load-state [state]="upcomingState" [what]="t.whatUpcoming" (retry)="reload()">
          @if (upcoming().length === 0) {
            <tb-empty-state icon="pi-calendar" [title]="t.noMoreTitle" [hint]="t.noMoreHint" />
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
                        icon="pi pi-chevron-right"
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
                        [inRow]="true"
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
      </p-card>

      @if (requests().length > 0) {
        <p-card [header]="t.requests">
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
                [icon]="resolvedOpen() ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
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
        </p-card>
      }

      <ng-template #requestRow let-request [tbRowType]="requests()">
        <li>
          <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-comments"></i></span>
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
      <p-card>
        @if (calendarState.status() === 'error') {
          <tb-load-state
            [state]="calendarState"
            [what]="t.whatCalendar"
            [compact]="true"
            (retry)="loadCalendar()"
          />
        }
        <tb-schedule-calendar
          [lessons]="calendarLessons()"
          [busy]="busy()"
          [busyTitle]="t.busy"
          [showStudent]="false"
          initialView="listWeek"
          [loaded]="calendarState.ready()"
          (rangeChange)="onRange($event)"
        />
      </p-card>
      <tb-calendar-feed-panel />
    </div>

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
      @if (sheetLesson(); as lesson) {
        <div class="tb-list__text">
          <tb-lesson-summary [lesson]="lesson" />
        </div>
        <tb-lesson-actions
          [stacked]="true"
          [joinUrl]="joinUrl(lesson)"
          [requests]="canAsk(lesson)"
          [group]="lesson.groupId !== null"
          rescheduleIcon="pi pi-calendar"
          (ask)="closeSheet(); ask(lesson, $event)"
        />
        @if (lesson.pendingRequests[0]; as request) {
          <p-button
            class="tb-tonal"
            severity="danger"
            [label]="t.withdrawRequest"
            icon="pi pi-undo"
            [fluid]="true"
            [loading]="actions.is('withdraw-' + request.id)"
            (onClick)="withdraw(request)"
          />
        }
      }
    </p-drawer>

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
  /** The lesson whose bottom sheet is open (a phone). */
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
    this.reload();
  }

  onRange(range: CalendarRange): void {
    this.range = range;
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
      return 'pi pi-video';
    }
    return lesson.groupId === null ? 'pi pi-calendar' : 'pi pi-users';
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
