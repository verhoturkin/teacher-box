import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
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
import { AttendanceDialog } from './attendance-dialog';
import { LessonDetailsDialog } from './lesson-details-dialog';
import { LessonDialog, LessonSlot, LessonStudent } from './lesson-dialog';
import { LessonGroup } from './lesson-owner';
import { OffTimeDialog } from './off-time-dialog';
import { RequestAnswerDialog } from './request-answer-dialog';
import { SeriesDialog } from './series-dialog';
import { EmptyState } from '@shared/ui/empty-state';
import { InitialsPipe } from '@shared/ui/initials';
import { PageHeader } from '@shared/ui/page-header';
import { dangerConfirmation, safeConfirmation } from '@shared/ui/confirmation';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { forkJoin } from 'rxjs';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';

/** A selection shorter than this is a click on a slot: the lesson gets the default duration. */
const CLICK_SELECTION_MINUTES = 30;

/**
 * The teacher's schedule, one card under another (ADR-0021): students' requests and lessons waiting
 * for an outcome first, then the calendar with lessons (select empty time to plan, drag to move),
 * regular series, the teacher's off time and the calendar link.
 * On a phone a new lesson is planned with the floating «+».
 */
@Component({
  selector: 'tb-schedule-page',
  imports: [
    InitialsPipe,
    HelpButton,
    Button,
    Card,
    ConfirmDialog,
    Tag,
    CalendarFeedPanel,
    LessonDetailsDialog,
    AttendanceDialog,
    LessonDialog,
    OffTimeDialog,
    RequestAnswerDialog,
    ScheduleCalendar,
    SeriesDialog,
    Tooltip,
    PageHeader,
    EmptyState,
    LoadStateView,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Расписание">
      <tb-help-button help topic="teacher/schedule" />
      <p-button class="tb-page-fab" label="Занятие" icon="pi pi-plus" (onClick)="newLesson()" />
    </tb-page-header>
    @if (localTimeHint(); as hint) {
      <p class="tb-hint">{{ hint }}</p>
    }

    <div class="tb-stack">
      @if (attentionState.status() === 'error') {
        <p-card header="Запросы учеников и прошедшие занятия">
          <tb-load-state
            [state]="attentionState"
            what="запросы и прошедшие занятия"
            [compact]="true"
            (retry)="loadAttention()"
          />
        </p-card>
      }
      @if (requests().length > 0) {
        <p-card header="Запросы учеников">
          <ul class="tb-list">
            @for (request of requests(); track request.id) {
              <li>
                <span class="tb-avatar" aria-hidden="true">{{
                  request.studentName ?? 'Ученик' | initials
                }}</span>
                <div class="tb-list__text">
                  <span class="tb-list__title">
                    {{ request.studentName ?? 'Ученик' }}
                    <p-tag [value]="kind(request)" [severity]="request.late ? 'warn' : 'info'" />
                  </span>
                  <span class="tb-list__supporting">
                    @if (request.groupName !== null) {
                      {{ request.groupName }},
                    }
                    {{ start(request.lessonStartsAt) }}
                    @if (request.proposedStartsAt !== null) {
                      → {{ start(request.proposedStartsAt) }}
                    }
                  </span>
                </div>
                <div class="tb-list__trail">
                  <p-button
                    label="Ответить"
                    [text]="true"
                    [ariaLabel]="'Ответить: ' + (request.studentName ?? 'ученик')"
                    (onClick)="answer(request)"
                  />
                </div>
              </li>
            }
          </ul>
        </p-card>
      }

      @if (unmarked().length > 0) {
        <p-card header="Отметьте прошедшие занятия">
          <ul class="tb-list">
            @for (lesson of unmarked(); track lesson.id) {
              <li>
                <span class="tb-avatar" aria-hidden="true">{{ with(lesson) | initials }}</span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ with(lesson) }}</span>
                  <span class="tb-list__supporting">{{ time(lesson) }}</span>
                </div>
                <div class="tb-list__trail">
                  @if (lesson.groupId !== null) {
                    <p-button
                      label="Отметить"
                      icon="pi pi-users"
                      severity="success"
                      [text]="true"
                      [ariaLabel]="'Отметить посещаемость: ' + with(lesson)"
                      (onClick)="markAttendance(lesson)"
                    />
                  } @else {
                    <p-button
                      icon="pi pi-check"
                      [text]="true"
                      [pTooltip]="'Проведено: ' + (lesson.studentName ?? 'ученик')"
                      [rounded]="true"
                      severity="success"
                      [ariaLabel]="'Проведено: ' + (lesson.studentName ?? 'ученик')"
                      [loading]="marks.is(lesson.id)"
                      (onClick)="mark(lesson, 'CONDUCTED')"
                    />
                    <p-button
                      icon="pi pi-user-minus"
                      [text]="true"
                      [pTooltip]="'Пропуск: ' + (lesson.studentName ?? 'ученик')"
                      [rounded]="true"
                      severity="danger"
                      [ariaLabel]="'Пропуск: ' + (lesson.studentName ?? 'ученик')"
                      [loading]="marks.is(lesson.id)"
                      (onClick)="mark(lesson, 'MISSED')"
                    />
                  }
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
            what="занятия"
            [compact]="true"
            (retry)="loadLessons()"
          />
        }
        <tb-schedule-calendar
          [lessons]="lessons()"
          [busy]="busy()"
          [offTime]="offTimePeriods()"
          [loaded]="calendarState.ready()"
          [editable]="true"
          (rangeChange)="onRange($event)"
          (lessonClick)="openLesson($event)"
          (slotSelect)="onSlot($event)"
          (lessonMove)="onMove($event)"
        />
      </p-card>

      <p-card>
        <ng-template #title>
          <div class="tb-card-title">
            <span class="tb-card-title__text">Регулярные занятия</span>
            <div class="tb-card-title__actions">
              <p-button
                label="Добавить"
                icon="pi pi-plus"
                severity="secondary"
                ariaLabel="Добавить регулярные занятия"
                (onClick)="newSeries()"
              />
            </div>
          </div>
        </ng-template>
        <tb-load-state
          [state]="seriesState"
          what="регулярные занятия"
          [compact]="true"
          (retry)="loadSeries()"
        >
          @if (series().length === 0) {
            <tb-empty-state icon="pi-replay" title="Нет регулярных занятий" />
          } @else {
            <ul class="tb-list">
              @for (item of series(); track item.id) {
                <li>
                  <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-replay"></i></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ with(item) }}</span>
                    <span class="tb-list__supporting">{{ weekly(item) }}</span>
                  </div>
                  <div class="tb-list__trail">
                    <p-button
                      icon="pi pi-pencil"
                      [text]="true"
                      [pTooltip]="'Изменить расписание: ' + with(item)"
                      [rounded]="true"
                      severity="secondary"
                      [ariaLabel]="'Изменить расписание: ' + with(item)"
                      (onClick)="editSeries(item)"
                    />
                    <p-button
                      icon="pi pi-stop-circle"
                      [text]="true"
                      [pTooltip]="'Завершить расписание: ' + with(item)"
                      [rounded]="true"
                      severity="danger"
                      [ariaLabel]="'Завершить расписание: ' + with(item)"
                      (onClick)="stopSeries(item)"
                    />
                  </div>
                </li>
              }
            </ul>
          }
        </tb-load-state>
      </p-card>

      <p-card>
        <ng-template #title>
          <div class="tb-card-title">
            <span class="tb-card-title__text">Нерабочее время</span>
            <div class="tb-card-title__actions">
              <p-button
                label="Добавить"
                icon="pi pi-plus"
                severity="secondary"
                ariaLabel="Добавить нерабочее время"
                (onClick)="newOffTime()"
              />
            </div>
          </div>
        </ng-template>
        <tb-load-state
          [state]="offTimesState"
          what="нерабочее время"
          [compact]="true"
          (retry)="loadOffTimes()"
        >
          @if (offTimes().length === 0) {
            <tb-empty-state
              icon="pi-moon"
              title="Нерабочее время не отмечено"
              hint="Отметьте обед, выходные или отпуск — ученики увидят это время занятым."
            />
          } @else {
            <ul class="tb-list">
              @for (item of offTimes(); track item.id) {
                <li>
                  <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-moon"></i></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ item.note ?? 'Не работаю' }}</span>
                    <span class="tb-list__supporting">{{ offTimeText(item) }}</span>
                  </div>
                  <div class="tb-list__trail">
                    <p-button
                      icon="pi pi-pencil"
                      [text]="true"
                      [pTooltip]="'Изменить нерабочее время: ' + offTimeText(item)"
                      [rounded]="true"
                      severity="secondary"
                      [ariaLabel]="'Изменить нерабочее время: ' + offTimeText(item)"
                      (onClick)="editOffTime(item)"
                    />
                    <p-button
                      icon="pi pi-trash"
                      [text]="true"
                      [pTooltip]="'Удалить нерабочее время: ' + offTimeText(item)"
                      [rounded]="true"
                      severity="danger"
                      [ariaLabel]="'Удалить нерабочее время: ' + offTimeText(item)"
                      (onClick)="deleteOffTime(item)"
                    />
                  </div>
                </li>
              }
            </ul>
          }
        </tb-load-state>
      </p-card>

      <tb-calendar-feed-panel />
    </div>

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
    <tb-attendance-dialog
      [(visible)]="attendanceVisible"
      [lesson]="selected()"
      (saved)="reload()"
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
})
export class SchedulePage implements OnInit {
  protected readonly marks = new Busy();
  private readonly api = inject(ScheduleApi);
  private readonly identity = inject(IdentityApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);

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
  protected readonly attendanceVisible = signal(false);
  protected readonly selected = signal<ScheduledLesson | null>(null);
  protected readonly seriesDialogVisible = signal(false);
  protected readonly editingSeries = signal<LessonSeries | null>(null);
  protected readonly offTimeDialogVisible = signal(false);
  protected readonly editingOffTime = signal<OffTime | null>(null);
  protected readonly answerVisible = signal(false);
  protected readonly answering = signal<ChangeRequest | null>(null);

  /** `?create=...` from the quick actions of the home page: opens the form at once. */
  readonly create = input<string>();

  protected readonly calendarState = new LoadState();
  protected readonly attentionState = new LoadState();
  protected readonly seriesState = new LoadState();
  protected readonly offTimesState = new LoadState();

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

  /** The attendance of a group lesson opens at once, not through the details of the lesson (ADR-0026). */
  markAttendance(lesson: ScheduledLesson): void {
    this.selected.set(lesson);
    this.attendanceVisible.set(true);
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
            this.snackbar.error(describeError(error, 'Не удалось перенести занятие'));
          }
        },
      });
  }

  mark(lesson: ScheduledLesson, outcome: LessonOutcome): void {
    this.marks.guard(lesson.id, this.api.setOutcome(lesson.id, outcome)).subscribe(() => {
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
    this.snackbar.success(`Расписание сохранено, занятий: ${String(planned.lessons)}`);
    this.reload();
  }

  stopSeries(series: LessonSeries): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: 'Завершить регулярные занятия?',
        message: `Занятия «${this.weekly(series)}» с сегодняшнего дня будут удалены из расписания. Перенесённые отдельно занятия останутся.`,
        acceptLabel: 'Завершить',
        accept: () => {
          this.api.stopSeries(series.id, toIsoDate(new Date())).subscribe(() => {
            this.reload();
          });
        },
      }),
    );
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
    this.snackbar.success('Нерабочее время сохранено');
    this.loadOffTimes();
    this.loadOffTimePeriods();
  }

  deleteOffTime(offTime: OffTime): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: 'Удалить нерабочее время?',
        message: `«${this.offTimeText(offTime)}» станет свободным временем для учеников.`,
        acceptLabel: 'Удалить',
        accept: () => {
          this.api.deleteOffTime(offTime.id).subscribe(() => {
            this.loadOffTimes();
            this.loadOffTimePeriods();
          });
        },
      }),
    );
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
    this.confirmation.confirm(
      safeConfirmation({
        header: 'Время занято',
        message: 'В это время уже есть другое занятие. Всё равно перенести?',
        acceptLabel: 'Перенести',
        accept: () => {
          this.onMove(move, true);
        },
        reject: () => {
          move.revert();
        },
      }),
    );
  }

  protected loadLessons(): void {
    const range = this.range;
    if (range === null) {
      return;
    }
    const widened = widen(range);
    this.api
      .lessons(widened.from, widened.to)
      .pipe(this.calendarState.track())
      .subscribe((lessons) => {
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

  protected loadOffTimes(): void {
    this.api
      .offTimes()
      .pipe(this.offTimesState.track())
      .subscribe((offTimes) => {
        this.offTimes.set(offTimes);
      });
  }

  /** Requests of students and lessons to mark: shown only when there are some. */
  protected loadAttention(): void {
    forkJoin({ requests: this.api.pendingRequests(), unmarked: this.api.unmarked() })
      .pipe(this.attentionState.track())
      .subscribe(({ requests, unmarked }) => {
        this.requests.set(requests);
        this.unmarked.set(unmarked);
      });
  }

  protected loadSeries(): void {
    this.api
      .series()
      .pipe(this.seriesState.track())
      .subscribe((series) => {
        this.series.set(series);
      });
  }

  private loadSidePanels(): void {
    this.loadOffTimes();
    this.loadAttention();
    this.loadSeries();
  }
}
