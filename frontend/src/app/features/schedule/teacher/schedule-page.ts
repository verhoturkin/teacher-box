import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Menu } from 'primeng/menu';
import { Tabs, Tab, TabList, TabPanel, TabPanels } from 'primeng/tabs';
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
import {
  CalendarRange,
  CalendarView,
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
import { TeacherColors } from '@features/identity/parts';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { Pane, Panes } from '@shared/ui/panes';
import { MiniMonth } from '../ui/mini-month';
import { ScheduleAgenda, weekDays, weekStart } from '../ui/schedule-agenda';
import { PageHeader } from '@shared/ui/page-header';
import { dangerConfirmation, safeConfirmation } from '@shared/ui/confirmation';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { forkJoin } from 'rxjs';
import { openOnCreate } from '@core/routing/create-param';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** A phone's screens: the agenda by default, the others from «⋮» of the top bar (spec §7). */
type PhoneScreen = 'agenda' | 'week' | 'month' | 'regular' | 'offTime';

const SCREENS: readonly PhoneScreen[] = ['agenda', 'week', 'month', 'regular', 'offTime'];

const SCREEN_TITLES: Record<PhoneScreen, () => string> = {
  agenda: () => T.page.screenAgenda,
  week: () => T.page.screenWeek,
  month: () => T.page.screenMonth,
  regular: () => T.page.series,
  offTime: () => T.page.offTime,
};

const SCREEN_ICONS: Record<PhoneScreen, string> = {
  agenda: 'tb-i tb-i-view_agenda',
  week: 'tb-i tb-i-calendar_view_week',
  month: 'tb-i tb-i-calendar_month',
  regular: 'tb-i tb-i-replay',
  offTime: 'tb-i tb-i-dark_mode',
};

/** A selection shorter than this is a click on a slot: the lesson gets the default duration. */
const CLICK_SELECTION_MINUTES = 30;
/** A day picked in the month view has no time: the lesson starts at this hour with the default duration. */
const ALL_DAY_START_HOUR = 10;

/**
 * The teacher's schedule (spec §7, ADR-0048): the calendar pane (toolbar with the time-zone chip and filter
 * chips, lessons waiting for an outcome, the calendar: select empty time to plan, drag to move) and the
 * supporting pane (mini-month, students' requests, tabs of recurring lessons and off time with their actions
 * in «⋮»).
 * On a phone a new lesson is planned with the floating «+».
 */
@Component({
  selector: 'tb-schedule-page',
  imports: [
    Avatar,
    ButtonAttributes,
    HelpButton,
    Button,
    Card,
    ConfirmDialog,
    Menu,
    Tabs,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tag,
    Panes,
    Pane,
    FilterChips,
    MiniMonth,
    LessonDetailsDialog,
    AttendanceDialog,
    LessonDialog,
    OffTimeDialog,
    RequestAnswerDialog,
    ScheduleAgenda,
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
    <tb-panes>
      <tb-pane [label]="t.calendarPane">
        <tb-page-header [title]="pageTitle()">
          <tb-help-button help topic="teacher/schedule" />
          <!-- wider, the rail's «Создать» is the page's FAB (spec §1 principle 5) -->
          @if (mobile()) {
            <p-button
              icon="tb-i tb-i-more_vert"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [ariaLabel]="t.screens"
              [tbAttributes]="{ 'aria-haspopup': 'menu' }"
              (onClick)="screenMenu().toggle($event)"
            />
            <p-button
              class="tb-page-fab"
              [label]="t.lesson"
              icon="tb-i tb-i-add"
              (onClick)="newLesson()"
            />
          }
        </tb-page-header>
        @if (calendarScreen()) {
          <div class="tb-schedule-toolbar">
            @if (zoneChip(); as chip) {
              <!-- only when the device zone is not the portal's one: replaces the text line -->
              <span class="tb-assist-chip" [attr.title]="localTimeHint()">
                <i class="tb-i tb-i-schedule" aria-hidden="true"></i>
                {{ chip }}
              </span>
            }
            <tb-filter-chips [label]="t.filters" [chips]="ownerChips()" [(value)]="ownerFilter" />
          </div>
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
          @if (calendarState.status() === 'error') {
            <tb-load-state
              [state]="calendarState"
              [what]="t.whatLessons"
              [compact]="true"
              (retry)="loadLessons()"
            />
          }
          @if (agendaShown()) {
            <tb-schedule-agenda
              [lessons]="shownLessons()"
              [unmarked]="unmarked()"
              [loaded]="calendarState.ready()"
              [marking]="isMarking"
              [day]="agendaDay()"
              (dayChange)="selectDay($event)"
              (lessonClick)="openLesson($event)"
              (mark)="mark($event.lesson, $event.outcome)"
              (markAttendance)="markAttendance($event)"
            />
          } @else if (calendarScreen()) {
            <tb-schedule-calendar
              [lessons]="shownLessons()"
              [busy]="busy()"
              [offTime]="offTimePeriods()"
              [unmarked]="unmarked()"
              [loaded]="calendarState.ready()"
              [editable]="true"
              [focusDate]="focusDate()"
              [initialDate]="calendarStart()"
              [phoneView]="phoneView()"
              (rangeChange)="onRange($event)"
              (lessonClick)="openLesson($event)"
              (slotSelect)="onSlot($event)"
              (lessonMove)="onMove($event)"
            />
          }
        </div>
      </tb-pane>

      @if (sideShown()) {
        <tb-pane kind="fixed" class="tb-schedule-side" [label]="t.sidePane">
          @if (!mobile()) {
            <tb-mini-month
              [current]="currentDay()"
              [marked]="lessonDays()"
              (dateSelect)="focusDate.set($event)"
            />
          }
          @if (requests().length > 0 && (!mobile() || screen() === 'agenda')) {
            <section class="tb-schedule-section">
              <h2 class="tb-schedule-section__title">{{ t.requests }}</h2>
              <ul class="tb-list">
                @for (request of requests(); track request.id) {
                  <li [attr.data-tb-label]="colors.studentLabel(request.studentId)">
                    <tb-avatar
                      [name]="request.studentName ?? c.student"
                      [photo]="request.studentAvatar"
                    />
                    <div class="tb-list__text">
                      <span class="tb-list__title">
                        {{ request.studentName ?? c.student }}
                        <p-tag
                          [value]="kind(request)"
                          [severity]="request.late ? 'warn' : 'info'"
                        />
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
            </section>
          }

          @if (!mobile() || tabsScreen()) {
            <p-tabs [(value)]="sideTab">
              @if (!mobile()) {
                <p-tablist>
                  <p-tab value="regular">{{ t.regular }}</p-tab>
                  <p-tab value="offTime">{{ t.offTime }}</p-tab>
                </p-tablist>
              }
              <p-tabpanels>
                <p-tabpanel value="regular">
                  <tb-load-state
                    [state]="seriesState"
                    [what]="t.whatSeries"
                    [compact]="true"
                    (retry)="loadSeries()"
                  >
                    @if (series().length === 0) {
                      <tb-empty-state
                        icon="tb-i-replay"
                        [title]="t.noSeriesTitle"
                        [hint]="t.noSeriesHint"
                      />
                    } @else {
                      <ul class="tb-list tb-list--no-phone-lead">
                        @for (item of series(); track item.id) {
                          <li>
                            <span class="tb-list__lead" aria-hidden="true"
                              ><i class="tb-i tb-i-replay"></i
                            ></span>
                            <div class="tb-list__text">
                              <span class="tb-list__title">{{ with(item) }}</span>
                              <span class="tb-list__supporting">{{ weekly(item) }}</span>
                            </div>
                            <div class="tb-list__trail tb-list__trail--icons">
                              <p-button
                                icon="tb-i tb-i-more_vert"
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

                  <p-button
                    [label]="t.addRegular"
                    icon="tb-i tb-i-add"
                    severity="secondary"
                    [fluid]="true"
                    [ariaLabel]="t.addSeries"
                    (onClick)="newSeries()"
                  />
                </p-tabpanel>
                <p-tabpanel value="offTime">
                  <tb-load-state
                    [state]="offTimesState"
                    [what]="t.whatOffTime"
                    [compact]="true"
                    (retry)="loadOffTimes()"
                  >
                    @if (offTimes().length === 0) {
                      <tb-empty-state
                        icon="tb-i-dark_mode"
                        [title]="t.noOffTimeTitle"
                        [hint]="t.noOffTimeHint"
                      />
                    } @else {
                      <ul class="tb-list tb-list--no-phone-lead">
                        @for (item of offTimes(); track item.id) {
                          <li>
                            <span class="tb-list__lead" aria-hidden="true"
                              ><i class="tb-i tb-i-dark_mode"></i
                            ></span>
                            <div class="tb-list__text">
                              <span class="tb-list__title">{{ item.note ?? t.notWorking }}</span>
                              <span class="tb-list__supporting">{{ offTimeText(item) }}</span>
                            </div>
                            <div class="tb-list__trail tb-list__trail--icons">
                              <p-button
                                icon="tb-i tb-i-more_vert"
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

                  <p-button
                    [label]="t.add"
                    icon="tb-i tb-i-add"
                    severity="secondary"
                    [fluid]="true"
                    [ariaLabel]="t.addOffTime"
                    (onClick)="newOffTime()"
                  />
                </p-tabpanel>
              </p-tabpanels>
            </p-tabs>
          }
        </tb-pane>
      }
    </tb-panes>

    <!-- «⋮» of a row of recurring lessons or days off: one popup menu serves every row -->
    <p-menu #screens [model]="screenItems()" [popup]="true" appendTo="body" />
    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />

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
    /* the supporting pane: M3 side-sheet surface (spec §7) */
    :host ::ng-deep .tb-schedule-side {
      background: var(--p-md-surface-container-low);
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }

    .tb-schedule-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2) var(--tb-space-4);
      margin-block-end: var(--tb-space-4);
    }

    /* M3 assist chip: 32 dp, 8 dp corners, 1 dp outline (our decision: not a button, it only informs) */
    .tb-assist-chip {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
      block-size: 2rem;
      box-sizing: border-box;
      padding: 0 var(--tb-space-4);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-sm);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
    }

    .tb-schedule-section__title {
      margin: 0 0 var(--tb-space-2);
      font: var(--tb-type-title-s);
    }
  `,
})
export class SchedulePage implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.page;
  protected readonly colors = inject(TeacherColors);
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
  /** The students and groups of the filter chips: one at a time, «Все» shows everything. */
  protected readonly ownerFilter = signal('all');
  protected readonly ownerChips = computed<FilterChip<string>[]>(() => [
    { value: 'all', label: T.page.allOwners },
    ...this.groups().map((group) => ({ value: `g:${group.id}`, label: group.name })),
    ...this.students().map((student) => ({ value: `s:${student.id}`, label: student.displayName })),
  ]);
  protected readonly shownLessons = computed(() => {
    const filter = this.ownerFilter();
    if (filter === 'all') {
      return this.lessons();
    }
    return this.lessons().filter((lesson) =>
      filter.startsWith('g:')
        ? `g:${lesson.groupId ?? ''}` === filter
        : `s:${lesson.studentId ?? ''}` === filter,
    );
  });
  /** The day the calendar shows, and the day the mini-month asked it to go to. */
  protected readonly currentDay = signal(toIsoDate(new Date()));
  protected readonly focusDate = signal<string | null>(null);
  protected readonly lessonDays = computed(
    () => new Set(this.lessons().map((lesson) => toIsoDate(new Date(lesson.startsAt)))),
  );
  protected readonly sideTab = signal<string | number>('regular');
  protected readonly localTimeHint = computed(() => {
    const zone = this.settings()?.timeZone;
    return zone === undefined || zone === browserTimeZone()
      ? null
      : T.page.localTime(browserTimeZone(), zone);
  });

  protected readonly zoneChip = computed(() => {
    const zone = this.settings()?.timeZone;
    return this.localTimeHint() === null || zone === undefined ? null : T.page.zoneChip(zone);
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

  /** A phone's screens («⋮» of the top bar, spec §7): the agenda is the first; each of the others is its own screen. */
  protected readonly screen = signal<PhoneScreen>('agenda');
  protected readonly agendaDay = signal(toIsoDate(new Date()));
  /** The day the week or month screen opens on: a snapshot, the calendar goes its own way after. */
  protected readonly calendarStart = signal<string | null>(null);
  protected readonly agendaShown = computed(() => this.mobile() && this.screen() === 'agenda');
  protected readonly calendarScreen = computed(
    () => !this.mobile() || ['agenda', 'week', 'month'].includes(this.screen()),
  );
  protected readonly tabsScreen = computed(
    () => this.screen() === 'regular' || this.screen() === 'offTime',
  );
  protected readonly sideShown = computed(
    () =>
      !this.mobile() ||
      this.tabsScreen() ||
      (this.screen() === 'agenda' && this.requests().length > 0),
  );
  protected readonly phoneView = computed<CalendarView | null>(() => {
    if (!this.mobile()) {
      return null;
    }
    return this.screen() === 'month' ? 'dayGridMonth' : 'timeGridWeek';
  });
  protected readonly pageTitle = computed(() => {
    const screen = this.screen();
    return !this.mobile() || screen === 'agenda' ? T.page.title : SCREEN_TITLES[screen]();
  });
  protected readonly screenItems = computed<MenuItem[]>(() =>
    SCREENS.map((screen) => ({
      label: SCREEN_TITLES[screen](),
      icon: SCREEN_ICONS[screen],
      disabled: screen === this.screen(),
      command: () => {
        this.openScreen(screen);
      },
    })),
  );
  protected readonly isMarking = (id: string): boolean => this.marks.is(id);

  private readonly menu = viewChild.required<Menu>('menu');
  protected readonly screenMenu = viewChild.required<Menu>('screens');
  /** The recurring lessons or the day off whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<string | null>(null);
  protected readonly menuItems = signal<MenuItem[]>([]);

  protected readonly calendarState = new LoadState();
  protected readonly attentionState = new LoadState();
  protected readonly seriesState = new LoadState();
  protected readonly offTimesState = new LoadState();

  private range: CalendarRange | null = null;
  private busyEnabled = false;

  constructor() {
    openOnCreate('lesson', () => {
      this.newLesson();
    });
  }

  ngOnInit(): void {
    if (this.mobile()) {
      this.selectDay(this.agendaDay());
    }
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
    this.api.googleStatus().subscribe((status) => {
      this.busyEnabled = status.status === 'CONNECTED' && status.busyEnabled;
      this.loadBusy();
    });
  }

  onRange(range: CalendarRange): void {
    this.range = range;
    this.currentDay.set(range.current);
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
      this.done(T.page.marked);
    });
  }

  /** A phone: goes to a screen of «⋮»; week and month open on the chosen day, the agenda reloads its week. */
  protected openScreen(screen: PhoneScreen): void {
    if (screen === 'week' || screen === 'month') {
      this.calendarStart.set(this.agendaDay());
    }
    this.screen.set(screen);
    if (screen === 'regular' || screen === 'offTime') {
      this.sideTab.set(screen === 'regular' ? 'regular' : 'offTime');
    } else if (screen === 'agenda') {
      this.selectDay(this.agendaDay(), true);
    }
  }

  /** The agenda's chosen day: its week is loaded when it is not the loaded one. */
  protected selectDay(day: string, force = false): void {
    this.agendaDay.set(day);
    const from = weekStart(day);
    if (force || this.range?.from !== from) {
      this.onRange({ from, to: weekDays(from)[6] ?? from, current: from });
    }
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
        icon: 'tb-i tb-i-edit',
        command: () => {
          this.editSeries(series);
        },
      },
      {
        label: T.page.stopItem,
        icon: 'tb-i tb-i-stop_circle',
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
        icon: 'tb-i tb-i-edit',
        command: () => {
          this.editOffTime(offTime);
        },
      },
      {
        label: T.page.deleteItem,
        icon: 'tb-i tb-i-delete',
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
