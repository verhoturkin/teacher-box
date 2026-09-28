import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tag } from 'primeng/tag';
import { HelpButton } from '@features/help/parts';
import { describeError } from '@core/http/error-messages';
import { injectMobile } from '@core/layout/mobile';
import { problemCode } from '@core/http/problem-detail';
import { IdentityApi } from '@features/identity/parts';
import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import { ScheduleApi } from '../data-access/schedule-api';
import {
  BusyTime,
  ChangeRequest,
  LessonOutcome,
  LessonSeries,
  OffTime,
  OffTimePeriod,
  ScheduleSettings,
  ScheduledLesson,
  SeriesPlanned,
} from '../data-access/schedule.models';
import {
  browserTimeZone,
  formatLessonStart,
  formatLessonTime,
  formatOffTime,
  formatWeekly,
  lessonWith,
  requestKindLabel,
  widen,
} from '../schedule-labels';
import { CalendarFeedPanel } from '../ui/calendar-feed-panel';
import {
  CalendarRange,
  LessonMove,
  ScheduleCalendar,
  SlotSelection,
} from '../ui/schedule-calendar';
import { LessonDetailsDialog } from './lesson-details-dialog';
import { LessonDialog, LessonSlot, LessonStudent } from './lesson-dialog';
import { LessonGroup } from './lesson-owner';
import { OffTimeDialog } from './off-time-dialog';
import { RequestAnswerDialog } from './request-answer-dialog';
import { SeriesDialog } from './series-dialog';

/** A selection shorter than this is a click on a slot: the lesson gets the default duration. */
const CLICK_SELECTION_MINUTES = 30;

/**
 * The teacher's schedule: the calendar with lessons (select empty time to plan, drag to move),
 * students' requests, lessons waiting for an outcome, regular series, the teacher's off time and the
 * calendar link.
 * On a phone a new lesson is planned with the floating «+».
 */
@Component({
  selector: 'tb-schedule-page',
  imports: [
    HelpButton,
    Button,
    Card,
    ConfirmDialog,
    Tag,
    CalendarFeedPanel,
    LessonDetailsDialog,
    LessonDialog,
    OffTimeDialog,
    RequestAnswerDialog,
    ScheduleCalendar,
    SeriesDialog,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-page-header">
      <div class="tb-page-heading">
        <h1 class="tb-page-title">Расписание</h1>
        <tb-help-button topic="teacher/schedule" />
      </div>
      <div class="tb-actions">
        @if (!mobile()) {
          <p-button label="Занятие" icon="pi pi-plus" (onClick)="newLesson()" />
        }
        <p-button
          label="Регулярные занятия"
          icon="pi pi-replay"
          [outlined]="true"
          (onClick)="newSeries()"
        />
        <p-button
          label="Нерабочее время"
          icon="pi pi-moon"
          [outlined]="true"
          (onClick)="newOffTime()"
        />
      </div>
    </div>
    @if (localTimeHint(); as hint) {
      <p class="tb-hint">{{ hint }}</p>
    }

    <div class="tb-schedule-layout">
      <p-card>
        <tb-schedule-calendar
          [lessons]="lessons()"
          [busy]="busy()"
          [offTime]="offTimePeriods()"
          [editable]="true"
          (rangeChange)="onRange($event)"
          (lessonClick)="openLesson($event)"
          (slotSelect)="onSlot($event)"
          (lessonMove)="onMove($event)"
        />
      </p-card>

      <div class="tb-stack">
        @if (requests().length > 0) {
          <p-card header="Запросы учеников">
            <ul class="tb-schedule-list">
              @for (request of requests(); track request.id) {
                <li>
                  <div>
                    <strong>{{ request.studentName ?? 'Ученик' }}</strong>
                    <p-tag [value]="kind(request)" [severity]="request.late ? 'warn' : 'info'" />
                    <div class="tb-muted">
                      @if (request.groupName !== null) {
                        {{ request.groupName }},
                      }
                      {{ start(request.lessonStartsAt) }}
                      @if (request.proposedStartsAt !== null) {
                        → {{ start(request.proposedStartsAt) }}
                      }
                    </div>
                  </div>
                  <p-button
                    label="Ответить"
                    size="small"
                    [outlined]="true"
                    (onClick)="answer(request)"
                  />
                </li>
              }
            </ul>
          </p-card>
        }

        @if (unmarked().length > 0) {
          <p-card header="Отметьте прошедшие занятия">
            <ul class="tb-schedule-list">
              @for (lesson of unmarked(); track lesson.id) {
                <li>
                  <div>
                    <strong>{{ with(lesson) }}</strong>
                    <div class="tb-muted">{{ time(lesson) }}</div>
                  </div>
                  <div class="tb-actions">
                    @if (lesson.groupId !== null) {
                      <p-button
                        label="Отметить"
                        icon="pi pi-users"
                        size="small"
                        [ariaLabel]="'Отметить посещаемость: ' + with(lesson)"
                        (onClick)="openLesson(lesson)"
                      />
                    } @else {
                      <p-button
                        icon="pi pi-check"
                        severity="success"
                        size="small"
                        [ariaLabel]="'Проведено: ' + (lesson.studentName ?? 'ученик')"
                        (onClick)="mark(lesson, 'CONDUCTED')"
                      />
                      <p-button
                        icon="pi pi-user-minus"
                        severity="warn"
                        size="small"
                        [outlined]="true"
                        [ariaLabel]="'Пропуск: ' + (lesson.studentName ?? 'ученик')"
                        (onClick)="mark(lesson, 'MISSED')"
                      />
                    }
                  </div>
                </li>
              }
            </ul>
          </p-card>
        }

        <p-card header="Регулярные занятия">
          @if (series().length === 0) {
            <p class="tb-muted">Нет регулярных занятий.</p>
          } @else {
            <ul class="tb-schedule-list">
              @for (item of series(); track item.id) {
                <li>
                  <div>
                    <strong>{{ with(item) }}</strong>
                    <div class="tb-muted">{{ weekly(item) }}</div>
                  </div>
                  <div class="tb-actions">
                    <p-button
                      icon="pi pi-pencil"
                      [text]="true"
                      size="small"
                      [ariaLabel]="'Изменить расписание: ' + with(item)"
                      (onClick)="editSeries(item)"
                    />
                    <p-button
                      icon="pi pi-stop-circle"
                      [text]="true"
                      severity="danger"
                      size="small"
                      [ariaLabel]="'Завершить расписание: ' + with(item)"
                      (onClick)="stopSeries(item)"
                    />
                  </div>
                </li>
              }
            </ul>
          }
        </p-card>

        <p-card header="Нерабочее время">
          @if (offTimes().length === 0) {
            <p class="tb-muted">
              Отметьте обед, выходные или отпуск — ученики увидят это время занятым.
            </p>
          } @else {
            <ul class="tb-schedule-list">
              @for (item of offTimes(); track item.id) {
                <li>
                  <div>
                    <strong>{{ item.note ?? 'Не работаю' }}</strong>
                    <div class="tb-muted">{{ offTimeText(item) }}</div>
                  </div>
                  <div class="tb-actions">
                    <p-button
                      icon="pi pi-pencil"
                      [text]="true"
                      size="small"
                      [ariaLabel]="'Изменить нерабочее время: ' + offTimeText(item)"
                      (onClick)="editOffTime(item)"
                    />
                    <p-button
                      icon="pi pi-trash"
                      [text]="true"
                      severity="danger"
                      size="small"
                      [ariaLabel]="'Удалить нерабочее время: ' + offTimeText(item)"
                      (onClick)="deleteOffTime(item)"
                    />
                  </div>
                </li>
              }
            </ul>
          }
        </p-card>

        <tb-calendar-feed-panel />
      </div>
    </div>

    @if (mobile()) {
      <p-button
        class="tb-fab"
        icon="pi pi-plus"
        [rounded]="true"
        size="large"
        ariaLabel="Новое занятие"
        (onClick)="newLesson()"
      />
    }

    <tb-lesson-dialog
      [(visible)]="lessonDialogVisible"
      [students]="students()"
      [groups]="groups()"
      [lesson]="editing()"
      [slot]="slot()"
      [defaultDuration]="defaultDuration()"
      (saved)="reload()"
    />
    <tb-lesson-details-dialog
      [(visible)]="detailsVisible"
      [lesson]="selected()"
      (changed)="reload()"
      (deleted)="reload()"
      (edit)="editLesson($event)"
    />
    <tb-series-dialog
      [(visible)]="seriesDialogVisible"
      [students]="students()"
      [groups]="groups()"
      [series]="editingSeries()"
      [defaultDuration]="defaultDuration()"
      [timeZone]="settings()?.timeZone ?? null"
      (saved)="onSeriesSaved($event)"
    />
    <tb-off-time-dialog
      [(visible)]="offTimeDialogVisible"
      [offTime]="editingOffTime()"
      [timeZone]="settings()?.timeZone ?? null"
      (saved)="onOffTimeSaved()"
    />
    <tb-request-answer-dialog
      [(visible)]="answerVisible"
      [request]="answering()"
      (answered)="reload()"
    />
    <p-confirmdialog />
  `,
  styles: `
    .tb-schedule-layout {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 1fr);
      gap: var(--tb-space-4);
      align-items: start;

      @media (max-width: 1100px) {
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
        align-items: center;
        justify-content: space-between;
        gap: var(--tb-space-2);
      }

      p-tag {
        margin-left: var(--tb-space-2);
      }
    }
  `,
})
export class SchedulePage implements OnInit {
  private readonly api = inject(ScheduleApi);
  private readonly identity = inject(IdentityApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  protected readonly mobile = injectMobile();
  protected readonly kind = requestKindLabel;
  protected readonly with = lessonWith;
  protected readonly settings = signal<ScheduleSettings | null>(null);
  protected readonly students = signal<LessonStudent[]>([]);
  protected readonly groups = signal<LessonGroup[]>([]);
  protected readonly lessons = signal<ScheduledLesson[]>([]);
  protected readonly requests = signal<ChangeRequest[]>([]);
  protected readonly unmarked = signal<ScheduledLesson[]>([]);
  protected readonly series = signal<LessonSeries[]>([]);
  protected readonly busy = signal<BusyTime[]>([]);
  protected readonly offTimes = signal<OffTime[]>([]);
  protected readonly offTimePeriods = signal<OffTimePeriod[]>([]);
  protected readonly defaultDuration = computed(
    () => this.settings()?.defaultDurationMinutes ?? 60,
  );
  protected readonly localTimeHint = computed(() => {
    const zone = this.settings()?.timeZone;
    return zone === undefined || zone === browserTimeZone()
      ? null
      : `Время показано по часовому поясу этого устройства (${browserTimeZone()}), расписание портала — ${zone}.`;
  });

  protected readonly lessonDialogVisible = signal(false);
  protected readonly editing = signal<ScheduledLesson | null>(null);
  protected readonly slot = signal<LessonSlot | null>(null);
  protected readonly detailsVisible = signal(false);
  protected readonly selected = signal<ScheduledLesson | null>(null);
  protected readonly seriesDialogVisible = signal(false);
  protected readonly editingSeries = signal<LessonSeries | null>(null);
  protected readonly offTimeDialogVisible = signal(false);
  protected readonly editingOffTime = signal<OffTime | null>(null);
  protected readonly answerVisible = signal(false);
  protected readonly answering = signal<ChangeRequest | null>(null);

  /** `?create=...` from the quick actions of the home page: opens the form at once. */
  readonly create = input<string>();

  private range: CalendarRange | null = null;
  private busyEnabled = false;

  ngOnInit(): void {
    this.api.settings().subscribe((settings) => {
      this.settings.set(settings);
    });
    this.identity.listStudents().subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
    });
    this.identity.listGroups().subscribe((groups) => {
      this.groups.set(
        groups
          .filter((group) => group.archivedAt === null && group.members.length > 0)
          .map((group) => ({ id: group.id, name: group.name })),
      );
    });
    this.loadSidePanels();
    if (this.create() === 'lesson') {
      this.newLesson();
    }
    this.api.googleStatus().subscribe((status) => {
      this.busyEnabled = status.status === 'CONNECTED' && status.busyEnabled;
      this.loadBusy();
    });
  }

  onRange(range: CalendarRange): void {
    this.range = range;
    this.loadLessons();
    this.loadBusy();
    this.loadOffTimePeriods();
  }

  /** Reloads everything a change of a lesson, series or request can affect. */
  reload(): void {
    this.loadLessons();
    this.loadSidePanels();
  }

  newLesson(): void {
    this.editing.set(null);
    this.slot.set(null);
    this.lessonDialogVisible.set(true);
  }

  onSlot(selection: SlotSelection): void {
    const minutes = Math.round((selection.end.getTime() - selection.start.getTime()) / 60_000);
    this.editing.set(null);
    this.slot.set({
      start: selection.start,
      durationMinutes: minutes > CLICK_SELECTION_MINUTES ? minutes : this.defaultDuration(),
    });
    this.lessonDialogVisible.set(true);
  }

  openLesson(lesson: ScheduledLesson): void {
    this.selected.set(lesson);
    this.detailsVisible.set(true);
  }

  editLesson(lesson: ScheduledLesson): void {
    this.editing.set(lesson);
    this.slot.set(null);
    this.lessonDialogVisible.set(true);
  }

  onMove(move: LessonMove, allowOverlap = false): void {
    const lesson = move.lesson;
    this.api
      .edit(lesson.id, {
        startsAt: move.startsAt.toISOString(),
        durationMinutes: lesson.durationMinutes,
        topic: lesson.topic,
        meetingUrl: lesson.meetingUrl,
        allowOverlap,
      })
      .subscribe({
        next: () => {
          this.reload();
        },
        error: (error: unknown) => {
          if (problemCode(error) === 'schedule.overlap') {
            this.confirmOverlap(move);
          } else {
            move.revert();
            this.messages.add({
              severity: 'error',
              summary: 'Ошибка',
              detail: describeError(error, 'Не удалось перенести занятие'),
            });
          }
        },
      });
  }

  mark(lesson: ScheduledLesson, outcome: LessonOutcome): void {
    this.api.setOutcome(lesson.id, outcome).subscribe(() => {
      this.reload();
    });
  }

  answer(request: ChangeRequest): void {
    this.answering.set(request);
    this.answerVisible.set(true);
  }

  newSeries(): void {
    this.editingSeries.set(null);
    this.seriesDialogVisible.set(true);
  }

  editSeries(series: LessonSeries): void {
    this.editingSeries.set(series);
    this.seriesDialogVisible.set(true);
  }

  onSeriesSaved(planned: SeriesPlanned): void {
    this.messages.add({
      severity: 'success',
      summary: 'Расписание сохранено',
      detail: `Запланировано занятий: ${String(planned.lessons)}`,
    });
    this.reload();
  }

  stopSeries(series: LessonSeries): void {
    this.confirmation.confirm({
      header: 'Завершить регулярные занятия?',
      message: `Занятия «${this.weekly(series)}» с сегодняшнего дня будут удалены из расписания. Перенесённые отдельно занятия останутся.`,
      acceptLabel: 'Завершить',
      rejectLabel: 'Назад',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.stopSeries(series.id, toIsoDate(new Date())).subscribe(() => {
          this.reload();
        });
      },
    });
  }

  newOffTime(): void {
    this.editingOffTime.set(null);
    this.offTimeDialogVisible.set(true);
  }

  editOffTime(offTime: OffTime): void {
    this.editingOffTime.set(offTime);
    this.offTimeDialogVisible.set(true);
  }

  onOffTimeSaved(): void {
    this.messages.add({ severity: 'success', summary: 'Нерабочее время сохранено' });
    this.loadOffTimes();
    this.loadOffTimePeriods();
  }

  deleteOffTime(offTime: OffTime): void {
    this.confirmation.confirm({
      header: 'Удалить нерабочее время?',
      message: `«${this.offTimeText(offTime)}» станет свободным временем для учеников.`,
      acceptLabel: 'Удалить',
      rejectLabel: 'Назад',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.api.deleteOffTime(offTime.id).subscribe(() => {
          this.loadOffTimes();
          this.loadOffTimePeriods();
        });
      },
    });
  }

  protected offTimeText(offTime: OffTime): string {
    return formatOffTime(offTime);
  }

  protected start(iso: string): string {
    return formatLessonStart(iso);
  }

  protected time(lesson: ScheduledLesson): string {
    return formatLessonTime(lesson.startsAt, lesson.endsAt);
  }

  protected weekly(series: LessonSeries): string {
    return formatWeekly(series.weekdays, series.startTime);
  }

  private confirmOverlap(move: LessonMove): void {
    this.confirmation.confirm({
      header: 'Время занято',
      message: 'В это время уже есть другое занятие. Всё равно перенести?',
      acceptLabel: 'Перенести',
      rejectLabel: 'Отмена',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.onMove(move, true);
      },
      reject: () => {
        move.revert();
      },
    });
  }

  private loadLessons(): void {
    const range = this.range;
    if (range === null) {
      return;
    }
    const widened = widen(range);
    this.api.lessons(widened.from, widened.to).subscribe((lessons) => {
      this.lessons.set(lessons);
    });
  }

  /** Busy times of the teacher's Google calendars, if the teacher allowed reading them. */
  private loadBusy(): void {
    const range = this.range;
    if (range === null || !this.busyEnabled) {
      return;
    }
    const widened = widen(range);
    this.api
      .googleBusy(fromIsoDate(widened.from).toISOString(), fromIsoDate(widened.to).toISOString())
      .subscribe((busy) => {
        this.busy.set(busy);
      });
  }

  private loadOffTimePeriods(): void {
    const range = this.range;
    if (range === null) {
      return;
    }
    const widened = widen(range);
    this.api
      .offTimePeriods(
        fromIsoDate(widened.from).toISOString(),
        fromIsoDate(widened.to).toISOString(),
      )
      .subscribe((periods) => {
        this.offTimePeriods.set(periods);
      });
  }

  private loadOffTimes(): void {
    this.api.offTimes().subscribe((offTimes) => {
      this.offTimes.set(offTimes);
    });
  }

  private loadSidePanels(): void {
    this.loadOffTimes();
    this.api.pendingRequests().subscribe((requests) => {
      this.requests.set(requests);
    });
    this.api.unmarked().subscribe((lessons) => {
      this.unmarked.set(lessons);
    });
    this.api.series().subscribe((series) => {
      this.series.set(series);
    });
  }
}
