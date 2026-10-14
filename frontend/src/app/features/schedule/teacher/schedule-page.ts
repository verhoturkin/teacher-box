import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Drawer } from 'primeng/drawer';
import { Menu } from 'primeng/menu';
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
import { Avatar } from '@shared/ui/avatar';
import { PageHeader } from '@shared/ui/page-header';
import { dangerConfirmation, safeConfirmation } from '@shared/ui/confirmation';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { forkJoin } from 'rxjs';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { RowType } from '@shared/ui/row-type.directive';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** A selection shorter than this is a click on a slot: the lesson gets the default duration. */
const CLICK_SELECTION_MINUTES = 30;
/** A day picked in the month view has no time: the lesson starts at this hour with the default duration. */
const ALL_DAY_START_HOUR = 10;

/**
 * The teacher's schedule, one card under another (ADR-0021): students' requests and lessons waiting
 * for an outcome first (labelled buttons; on a phone the row opens a bottom sheet with them), then the calendar with lessons (select empty time to plan, drag to move),
 * regular series, the teacher's off time (their actions in «⋮») and the calendar link.
 * On a phone a new lesson is planned with the floating «+».
 */
@Component({
  selector: 'tb-schedule-page',
  imports: [
    NgTemplateOutlet,
    Avatar,
    ButtonAttributes,
    HelpButton,
    Button,
    Card,
    ConfirmDialog,
    Drawer,
    Menu,
    ModalDrawer,
    RowType,
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
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="teacher/schedule" />
      <p-button class="tb-page-fab" [label]="t.lesson" icon="pi pi-plus" (onClick)="newLesson()" />
    </tb-page-header>
    @if (localTimeHint(); as hint) {
      <p class="tb-hint">{{ hint }}</p>
    }

    <div class="tb-stack">
      @if (attentionState.status() === 'error') {
        <p-card [header]="t.attention">
          <tb-load-state
            [state]="attentionState"
            [what]="t.whatAttention"
            [compact]="true"
            (retry)="loadAttention()"
          />
        </p-card>
      }
      @if (requests().length > 0) {
        <p-card [header]="t.requests">
          <ul class="tb-list">
            @for (request of requests(); track request.id) {
              <li>
                <tb-avatar
                  [name]="request.studentName ?? c.student"
                  [photo]="request.studentAvatar"
                />
                <div class="tb-list__text">
                  <span class="tb-list__title">
                    {{ request.studentName ?? c.student }}
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
                    [label]="t.answer"
                    [text]="true"
                    [ariaLabel]="t.answerTo(request.studentName ?? t.student)"
                    (onClick)="answer(request)"
                  />
                </div>
              </li>
            }
          </ul>
        </p-card>
      }

      @if (unmarked().length > 0) {
        <p-card [header]="t.unmarked">
          <ul class="tb-list">
            @for (lesson of unmarked(); track lesson.id) {
              <li [class.tb-list__item--link]="mobile()">
                <tb-avatar [name]="with(lesson)" [photo]="lesson.studentAvatar" />
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ with(lesson) }}</span>
                  <span class="tb-list__supporting">{{ time(lesson) }}</span>
                </div>
                @if (mobile()) {
                  <!-- a phone: the row stays one line, its buttons are in the bottom sheet -->
                  <div class="tb-list__trail tb-list__trail--icons">
                    <!-- stretched over the row: the whole row opens the sheet -->
                    <p-button
                      class="tb-list__stretched"
                      icon="pi pi-chevron-right"
                      severity="secondary"
                      [text]="true"
                      [rounded]="true"
                      [ariaLabel]="t.markLesson(with(lesson))"
                      (onClick)="openSheet(lesson)"
                    />
                  </div>
                } @else {
                  <div class="tb-list__trail">
                    <ng-container *ngTemplateOutlet="markButtons; context: { $implicit: lesson }" />
                  </div>
                }
              </li>
            }
          </ul>
        </p-card>
      }

      <!-- the buttons of a past lesson: text in a row; on a phone (in the sheet) full width -->
      <ng-template #markButtons let-lesson [tbRowType]="unmarked()">
        @if (lesson.groupId !== null) {
          <p-button
            [label]="t.mark"
            icon="pi pi-users"
            [text]="!mobile()"
            [fluid]="mobile()"
            [ariaLabel]="t.markAttendance(with(lesson))"
            (onClick)="markAttendance(lesson)"
          />
        } @else {
          <p-button
            [label]="t.conductedLabel"
            icon="pi pi-check"
            [text]="!mobile()"
            [fluid]="mobile()"
            [ariaLabel]="t.conducted(lesson.studentName ?? t.student)"
            [loading]="marks.is(lesson.id)"
            (onClick)="mark(lesson, 'CONDUCTED')"
          />
          <p-button
            [label]="t.missedLabel"
            icon="pi pi-user-minus"
            severity="secondary"
            [text]="!mobile()"
            [fluid]="mobile()"
            [ariaLabel]="t.missed(lesson.studentName ?? t.student)"
            [loading]="marks.is(lesson.id)"
            (onClick)="mark(lesson, 'MISSED')"
          />
        }
      </ng-template>

      <p-card>
        @if (calendarState.status() === 'error') {
          <tb-load-state
            [state]="calendarState"
            [what]="t.whatLessons"
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
            <span class="tb-card-title__text">{{ t.series }}</span>
            <div class="tb-card-title__actions">
              <p-button
                [label]="t.add"
                icon="pi pi-plus"
                severity="secondary"
                [ariaLabel]="t.addSeries"
                (onClick)="newSeries()"
              />
            </div>
          </div>
        </ng-template>
        <tb-load-state
          [state]="seriesState"
          [what]="t.whatSeries"
          [compact]="true"
          (retry)="loadSeries()"
        >
          @if (series().length === 0) {
            <tb-empty-state icon="pi-replay" [title]="t.noSeriesTitle" [hint]="t.noSeriesHint" />
          } @else {
            <ul class="tb-list tb-list--no-phone-lead">
              @for (item of series(); track item.id) {
                <li>
                  <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-replay"></i></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ with(item) }}</span>
                    <span class="tb-list__supporting">{{ weekly(item) }}</span>
                  </div>
                  <div class="tb-list__trail tb-list__trail--icons">
                    <p-button
                      icon="pi pi-ellipsis-v"
                      [text]="true"
                      [rounded]="true"
                      severity="secondary"
                      [pTooltip]="t.actions(with(item))"
                      [ariaLabel]="t.actions(with(item))"
                      [tbAttributes]="{
                        'aria-haspopup': 'menu',
                        'aria-expanded': menuFor() === item.id ? 'true' : 'false',
                      }"
                      (onClick)="openMenu(item.id, seriesMenu(item), $event)"
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
            <span class="tb-card-title__text">{{ t.offTime }}</span>
            <div class="tb-card-title__actions">
              <p-button
                [label]="t.add"
                icon="pi pi-plus"
                severity="secondary"
                [ariaLabel]="t.addOffTime"
                (onClick)="newOffTime()"
              />
            </div>
          </div>
        </ng-template>
        <tb-load-state
          [state]="offTimesState"
          [what]="t.whatOffTime"
          [compact]="true"
          (retry)="loadOffTimes()"
        >
          @if (offTimes().length === 0) {
            <tb-empty-state icon="pi-moon" [title]="t.noOffTimeTitle" [hint]="t.noOffTimeHint" />
          } @else {
            <ul class="tb-list tb-list--no-phone-lead">
              @for (item of offTimes(); track item.id) {
                <li>
                  <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-moon"></i></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ item.note ?? t.notWorking }}</span>
                    <span class="tb-list__supporting">{{ offTimeText(item) }}</span>
                  </div>
                  <div class="tb-list__trail tb-list__trail--icons">
                    <p-button
                      icon="pi pi-ellipsis-v"
                      [text]="true"
                      [rounded]="true"
                      severity="secondary"
                      [pTooltip]="t.actions(offTimeText(item))"
                      [ariaLabel]="t.actions(offTimeText(item))"
                      [tbAttributes]="{
                        'aria-haspopup': 'menu',
                        'aria-expanded': menuFor() === item.id ? 'true' : 'false',
                      }"
                      (onClick)="openMenu(item.id, offTimeMenu(item), $event)"
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

    <!-- «⋮» of a row of recurring lessons or days off: one popup menu serves every row -->
    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />

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
        <p class="tb-muted">{{ time(lesson) }}</p>
        <div class="tb-sheet-actions">
          <ng-container *ngTemplateOutlet="markButtons; context: { $implicit: lesson }" />
        </div>
      }
    </p-drawer>

    <tb-lesson-dialog
      [(visible)]="lessonDialogVisible"
      [students]="students()"
      [groups]="groups()"
      [lesson]="editing()"
      [slot]="slot()"
      [defaultDuration]="defaultDuration()"
      (saved)="done(t.saved)"
    />
    <tb-lesson-details-dialog
      [(visible)]="detailsVisible"
      [lesson]="selected()"
      (changed)="done(t.updated)"
      (deleted)="done(t.deleted)"
      (edit)="editLesson($event)"
    />
    <tb-attendance-dialog
      [(visible)]="attendanceVisible"
      [lesson]="selected()"
      (saved)="done(t.attendanceSaved)"
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
      (answered)="done(t.answered)"
    />
    <p-confirmdialog />
  `,
  styles: `
    /* the bottom sheet of a lesson to mark: its buttons one under another, across the width */
    .tb-sheet-actions {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
    }
  `,
})
export class SchedulePage implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.page;
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
      : T.page.localTime(browserTimeZone(), zone);
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

  /** The past lesson whose bottom sheet is open (a phone). */
  protected readonly sheetLesson = signal<ScheduledLesson | null>(null);
  protected readonly sheetTitle = computed(() => {
    const lesson = this.sheetLesson();
    return lesson === null ? '' : lessonWith(lesson);
  });

  private readonly menu = viewChild.required<Menu>('menu');
  /** The recurring lessons or the day off whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<string | null>(null);
  protected readonly menuItems = signal<MenuItem[]>([]);

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
          .map((student) => ({
            id: student.id,
            displayName: student.displayName,
            defaultTopic: student.defaultTopic,
          })),
      );
    });
    this.identity.listGroups().subscribe((groups) => {
      this.groups.set(
        groups
          .filter((group) => group.archivedAt === null && group.members.length > 0)
          .map((group) => ({ id: group.id, name: group.name, defaultTopic: group.defaultTopic })),
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
    this.editing.set(null);
    if (selection.allDay === true) {
      const start = new Date(selection.start);
      start.setHours(ALL_DAY_START_HOUR, 0, 0, 0);
      this.slot.set({ start, durationMinutes: this.defaultDuration() });
    } else {
      const minutes = Math.round((selection.end.getTime() - selection.start.getTime()) / 60_000);
      this.slot.set({
        start: selection.start,
        durationMinutes: minutes > CLICK_SELECTION_MINUTES ? minutes : this.defaultDuration(),
      });
    }
    this.lessonDialogVisible.set(true);
  }

  openLesson(lesson: ScheduledLesson): void {
    this.selected.set(lesson);
    this.detailsVisible.set(true);
  }

  /** The result of a frequent action is told at once: the lesson may be out of the screen (ADR-0026). */
  protected done(message: string): void {
    this.snackbar.success(message);
    this.reload();
  }

  /** The attendance of a group lesson opens at once, not through the details of the lesson (ADR-0026). */
  markAttendance(lesson: ScheduledLesson): void {
    this.closeSheet();
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
            this.snackbar.error(describeError(error, T.page.moveFailed));
          }
        },
      });
  }

  mark(lesson: ScheduledLesson, outcome: LessonOutcome): void {
    this.marks.guard(lesson.id, this.api.setOutcome(lesson.id, outcome)).subscribe(() => {
      this.closeSheet();
      this.done(T.page.marked);
    });
  }

  openSheet(lesson: ScheduledLesson): void {
    this.sheetLesson.set(lesson);
  }

  closeSheet(): void {
    this.sheetLesson.set(null);
  }

  protected openMenu(id: string, items: MenuItem[], event: Event): void {
    this.menuFor.set(id);
    this.menuItems.set(items);
    this.menu().toggle(event);
  }

  /** «Изменить» and «Завершить…» of recurring lessons. */
  protected seriesMenu(series: LessonSeries): MenuItem[] {
    return [
      {
        label: T.page.editItem,
        icon: 'pi pi-pencil',
        command: () => {
          this.editSeries(series);
        },
      },
      {
        label: T.page.stopItem,
        icon: 'pi pi-stop-circle',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          this.stopSeries(series);
        },
      },
    ];
  }

  /** «Изменить» and «Удалить…» of a day off. */
  protected offTimeMenu(offTime: OffTime): MenuItem[] {
    return [
      {
        label: T.page.editItem,
        icon: 'pi pi-pencil',
        command: () => {
          this.editOffTime(offTime);
        },
      },
      {
        label: T.page.deleteItem,
        icon: 'pi pi-trash',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          this.deleteOffTime(offTime);
        },
      },
    ];
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
    this.snackbar.success(T.page.seriesSaved(planned.lessons));
    this.reload();
  }

  stopSeries(series: LessonSeries): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.page.stopHeader,
        message: T.page.stopMessage(this.weekly(series)),
        acceptLabel: T.page.stop,
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
    this.snackbar.success(T.page.offTimeSaved);
    this.loadOffTimes();
    this.loadOffTimePeriods();
  }

  deleteOffTime(offTime: OffTime): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.page.deleteOffTimeHeader,
        message: T.page.deleteOffTimeMessage(this.offTimeText(offTime)),
        acceptLabel: T.page.delete,
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
        header: T.page.busyHeader,
        message: T.page.busyMessage,
        acceptLabel: T.page.move,
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
