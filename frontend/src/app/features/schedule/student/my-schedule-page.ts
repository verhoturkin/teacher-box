import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Drawer } from 'primeng/drawer';
import { Tag } from 'primeng/tag';
import { injectMobile } from '@core/layout/mobile';
import { HelpButton } from '@features/help/parts';
import { MyBoardsCard } from '@features/boards/parts';
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

/** The day after the end of the week of `date` (Monday; the week starts on Monday). */
export function nextMonday(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() + 7 - ((monday.getDay() + 6) % 7));
  return monday;
}

/**
 * The student's schedule, one card under another (ADR-0021): upcoming lessons of this week with the
 * link to the online lesson and requests to move or cancel them, the student's requests, the
 * calendar, the boards and the calendar link.
 */
@Component({
  selector: 'tb-my-schedule-page',
  imports: [
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
    MyBoardsCard,
    ScheduleCalendar,
    ModalDrawer,
    LoadStateView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Расписание">
      <tb-help-button help topic="cabinet/schedule" />
    </tb-page-header>
    <div class="tb-stack">
      <p-card header="Ближайшие занятия">
        <tb-load-state [state]="upcomingState" what="ближайшие занятия" (retry)="reload()">
          @if (upcoming().length === 0) {
            <tb-empty-state
              icon="pi-calendar"
              title="На этой неделе занятий больше нет"
              hint="Следующие занятия — в календаре"
            />
          } @else {
            <ul class="tb-list tb-schedule-list">
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
                        [ariaLabel]="'Занятие: ' + time(lesson)"
                        (onClick)="openSheet(lesson)"
                      />
                    </div>
                  } @else {
                    <div class="tb-list__trail">
                      <tb-lesson-actions
                        [inRow]="true"
                        [joinUrl]="joinUrl(lesson)"
                        joinLabel="Подключиться"
                        [requests]="canAsk(lesson)"
                        [group]="lesson.groupId !== null"
                        (ask)="ask(lesson, $event)"
                      />
                      @if (lesson.pendingRequests[0]; as request) {
                        <p-button
                          severity="danger"
                          label="Отозвать"
                          [text]="true"
                          [ariaLabel]="'Отозвать запрос: ' + time(lesson)"
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
        <p-card header="Мои запросы">
          <ul class="tb-list tb-schedule-list">
            @for (request of requests(); track request.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-comments"></i></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">
                    {{ kind(request) }}: {{ start(request.lessonStartsAt) }}
                    @if (request.groupName !== null) {
                      · группа «{{ request.groupName }}»
                    }
                  </span>
                  @if (request.answer !== null) {
                    <span class="tb-list__supporting">Учитель: {{ request.answer }}</span>
                  }
                </div>
                <div class="tb-list__trail">
                  <p-tag
                    [value]="requestStatuses[request.status].label"
                    [severity]="requestStatuses[request.status].severity"
                  />
                </div>
              </li>
            }
          </ul>
        </p-card>
      }
      <p-card>
        @if (calendarState.status() === 'error') {
          <tb-load-state
            [state]="calendarState"
            what="календарь"
            [compact]="true"
            (retry)="loadCalendar()"
          />
        }
        <tb-schedule-calendar
          [lessons]="calendarLessons()"
          [busy]="busy()"
          busyTitle="Занято"
          [showStudent]="false"
          initialView="listWeek"
          [loaded]="calendarState.ready()"
          (rangeChange)="onRange($event)"
        />
      </p-card>
      <tb-my-boards-card />
      <tb-calendar-feed-panel />
    </div>

    <p-drawer
      tbModalDrawer
      [blockScroll]="true"
      ariaCloseLabel="Закрыть"
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
          joinLabel="Подключиться"
          [requests]="canAsk(lesson)"
          [group]="lesson.groupId !== null"
          rescheduleIcon="pi pi-calendar"
          (ask)="closeSheet(); ask(lesson, $event)"
        />
        @if (lesson.pendingRequests[0]; as request) {
          <p-button
            class="tb-tonal"
            severity="danger"
            label="Отозвать запрос"
            icon="pi pi-undo"
            [fluid]="true"
            (onClick)="closeSheet(); withdraw(request)"
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
})
export class MySchedulePage implements OnInit {
  private readonly api = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);

  protected readonly kind = requestKindLabel;
  protected readonly requestStatuses = REQUEST_STATUS_LABELS;
  protected readonly settings = signal<ScheduleSettings | null>(null);
  protected readonly upcomingLessons = signal<ScheduledLesson[]>([]);
  protected readonly calendarLessons = signal<ScheduledLesson[]>([]);
  protected readonly busy = signal<BusyTime[]>([]);
  protected readonly requests = signal<ChangeRequest[]>([]);
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
    this.snackbar.success('Учитель получит ваш запрос');
    this.reload();
  }

  withdraw(request: ChangeRequest): void {
    this.api.withdraw(request.id).subscribe(() => {
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
