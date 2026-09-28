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
import { JoinLessonButton } from '@features/meetings/parts';
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
import { CalendarRange, ScheduleCalendar } from '../ui/schedule-calendar';
import { ChangeRequestDialog } from './change-request-dialog';
import { EmptyState } from '@shared/ui/empty-state';

/** How far ahead the list of upcoming lessons looks. */
export const UPCOMING_DAYS = 60;

/**
 * The student's schedule: upcoming lessons with the link to the online lesson and requests to
 * move or cancel them, the calendar, the student's requests and the calendar link.
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
    JoinLessonButton,
    MyBoardsCard,
    ScheduleCalendar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-page-heading">
      <h1 class="tb-page-title">Расписание</h1>
      <tb-help-button topic="cabinet/schedule" />
    </div>
    <div class="tb-schedule-layout">
      <div class="tb-stack">
        <p-card header="Ближайшие занятия">
          @if (upcoming().length === 0) {
            <tb-empty-state icon="pi-calendar" title="Запланированных занятий пока нет" />
          } @else {
            <ul class="tb-schedule-list">
              @for (lesson of upcoming(); track lesson.id) {
                <li>
                  <div class="tb-schedule-list__main">
                    <strong>{{ time(lesson) }}</strong>
                    @if (lesson.groupId !== null) {
                      <span>{{ with(lesson) }}</span>
                    }
                    @if (lesson.topic !== null) {
                      <span>{{ lesson.topic }}</span>
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
                      <small class="tb-muted">
                        Запрос «{{ kind(request) }}» ждёт ответа учителя
                        <p-button
                          label="Отозвать"
                          [link]="true"
                          size="small"
                          (onClick)="withdraw(request)"
                        />
                      </small>
                    }
                  </div>
                  <div class="tb-actions">
                    @if (lesson.joinUrl !== null && lesson.status === 'SCHEDULED') {
                      <tb-join-lesson-button
                        [url]="lesson.joinUrl"
                        label="Подключиться"
                        [small]="true"
                      />
                    }
                    @if (
                      lesson.status === 'SCHEDULED' &&
                      lesson.pendingRequests.length === 0 &&
                      !excused(lesson)
                    ) {
                      <p-button
                        label="Перенести"
                        size="small"
                        [outlined]="true"
                        (onClick)="ask(lesson, 'RESCHEDULE')"
                      />
                      <p-button
                        [label]="lesson.groupId === null ? 'Отменить' : 'Не приду'"
                        size="small"
                        severity="secondary"
                        [text]="true"
                        (onClick)="ask(lesson, 'CANCEL')"
                      />
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </p-card>

        <p-card>
          <tb-schedule-calendar
            [lessons]="calendarLessons()"
            [busy]="busy()"
            [showStudent]="false"
            initialView="listWeek"
            (rangeChange)="onRange($event)"
          />
        </p-card>
      </div>

      <div class="tb-stack">
        @if (requests().length > 0) {
          <p-card header="Мои запросы">
            <ul class="tb-schedule-list">
              @for (request of requests(); track request.id) {
                <li>
                  <div class="tb-schedule-list__main">
                    <span>
                      {{ kind(request) }}: {{ start(request.lessonStartsAt) }}
                      @if (request.groupName !== null) {
                        · группа «{{ request.groupName }}»
                      }
                    </span>
                    @if (request.answer !== null) {
                      <small class="tb-muted">Учитель: {{ request.answer }}</small>
                    }
                  </div>
                  <p-tag
                    [value]="requestStatuses[request.status].label"
                    [severity]="requestStatuses[request.status].severity"
                  />
                </li>
              }
            </ul>
          </p-card>
        }
        <tb-my-boards-card />
        <tb-calendar-feed-panel />
      </div>
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
  styles: `
    .tb-schedule-layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: var(--tb-space-4);
      align-items: start;

      @media (max-width: 900px) {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .tb-schedule-list {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--tb-space-2);
      }
    }

    .tb-schedule-list__main {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
    }
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
    const until = new Date(today);
    until.setDate(until.getDate() + UPCOMING_DAYS);
    this.api.myLessons(toIsoDate(today), toIsoDate(until)).subscribe((lessons) => {
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
