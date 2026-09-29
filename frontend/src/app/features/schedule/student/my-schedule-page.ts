import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
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
  STATUS_LABELS,
  formatLessonStart,
  formatLessonTime,
  lessonWith,
  requestKindLabel,
  widen,
} from '../schedule-labels';
import { CalendarFeedPanel } from '../ui/calendar-feed-panel';
import { LessonActions } from '../ui/lesson-actions';
import { CalendarRange, ScheduleCalendar } from '../ui/schedule-calendar';
import { ChangeRequestDialog } from './change-request-dialog';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';

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
    EmptyState,
    HelpButton,
    Button,
    Card,
    Tag,
    CalendarFeedPanel,
    ChangeRequestDialog,
    LessonActions,
    MyBoardsCard,
    ScheduleCalendar,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Расписание">
      <tb-help-button help topic="cabinet/schedule" />
    </tb-page-header>
    <div class="tb-stack">
      <p-card header="Ближайшие занятия">
        @if (upcoming().length === 0) {
          <tb-empty-state
            icon="pi-calendar"
            title="На этой неделе занятий больше нет"
            hint="Следующие занятия — в календаре"
          />
        } @else {
          <ul class="tb-list tb-schedule-list">
            @for (lesson of upcoming(); track lesson.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true">
                  <i [class]="lesson.groupId === null ? 'pi pi-calendar' : 'pi pi-users'"></i>
                </span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ time(lesson) }}</span>
                  @if (lesson.groupId !== null) {
                    <span class="tb-list__supporting">{{ with(lesson) }}</span>
                  }
                  @if (lesson.topic !== null) {
                    <span class="tb-list__supporting">{{ lesson.topic }}</span>
                  }
                  @if (lesson.status !== 'SCHEDULED') {
                    <p-tag
                      [value]="statuses[lesson.status].label"
                      [severity]="statuses[lesson.status].severity"
                    />
                  }
                  @if (excused(lesson)) {
                    <p-tag value="Вы предупредили, что не придёте" severity="secondary" />
                  }
                  @if (lesson.pendingRequests[0]; as request) {
                    <span class="tb-list__supporting"
                      >Запрос «{{ kind(request) }}» ждёт ответа учителя</span
                    >
                  }
                </div>
                <div class="tb-list__trail">
                  <tb-lesson-actions
                    [joinUrl]="lesson.status === 'SCHEDULED' ? lesson.joinUrl : null"
                    joinLabel="Подключиться"
                    [requests]="
                      lesson.status === 'SCHEDULED' &&
                      lesson.pendingRequests.length === 0 &&
                      !excused(lesson)
                    "
                    [group]="lesson.groupId !== null"
                    [lessonName]="time(lesson)"
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
              </li>
            }
          </ul>
        }
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
        <tb-schedule-calendar
          [lessons]="calendarLessons()"
          [busy]="busy()"
          busyTitle="Занято"
          [showStudent]="false"
          initialView="listWeek"
          (rangeChange)="onRange($event)"
        />
      </p-card>
      <tb-my-boards-card />
      <tb-calendar-feed-panel />
    </div>

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
  private readonly messages = inject(MessageService);

  protected readonly kind = requestKindLabel;
  protected readonly with = lessonWith;
  protected readonly statuses = STATUS_LABELS;
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

  protected readonly requestVisible = signal(false);
  protected readonly requestLesson = signal<ScheduledLesson | null>(null);
  protected readonly requestKind = signal<ChangeKind>('RESCHEDULE');

  private range: CalendarRange | null = null;

  ngOnInit(): void {
    this.api.settings().subscribe((settings) => {
      this.settings.set(settings);
    });
    this.reload();
  }

  onRange(range: CalendarRange): void {
    this.range = range;
    this.loadCalendar();
  }

  /** The student said they would not come to this group lesson. */
  protected excused(lesson: ScheduledLesson): boolean {
    return lesson.participants.some((participant) => participant.attendance === 'EXCUSED');
  }

  ask(lesson: ScheduledLesson, kind: ChangeKind): void {
    this.now.set(new Date());
    this.requestLesson.set(lesson);
    this.requestKind.set(kind);
    this.requestVisible.set(true);
  }

  onSent(): void {
    this.messages.add({
      severity: 'success',
      summary: 'Отправлено',
      detail: 'Учитель получит ваш запрос',
    });
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

  private reload(): void {
    this.now.set(new Date());
    const today = this.now();
    this.api.myLessons(toIsoDate(today), toIsoDate(nextMonday(today))).subscribe((lessons) => {
      this.upcomingLessons.set(lessons);
    });
    this.api.myRequests().subscribe((requests) => {
      this.requests.set(requests);
    });
    this.loadCalendar();
  }

  private loadCalendar(): void {
    const range = this.range;
    if (range === null) {
      return;
    }
    const widened = widen(range);
    this.api.myLessons(widened.from, widened.to).subscribe((lessons) => {
      this.calendarLessons.set(lessons);
    });
    this.api
      .teacherBusy(fromIsoDate(widened.from).toISOString(), fromIsoDate(widened.to).toISOString())
      .subscribe((busy) => {
        this.busy.set(busy);
      });
  }
}
