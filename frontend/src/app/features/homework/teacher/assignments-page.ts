import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Select } from 'primeng/select';
import { injectMobile, injectWindowSize } from '@core/layout/mobile';
import { collapseRail, hideBottomBar, RailState } from '@core/layout/rail-state';
import { Snackbar } from '@core/snackbar/snackbar';
import { openOnCreate } from '@core/routing/create-param';
import { readQuery, writeQuery } from '@core/routing/query-state';
import { HelpButton } from '@features/help/parts';
import { EmptyState } from '@shared/ui/empty-state';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { SearchField } from '@shared/ui/search-field';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';
import { AssignmentPage } from './assignment-page';
import { DeadlineKey, groupByDeadline } from './deadline-groups';
import { JournalView } from './journal-view';
import { NextWork, ReviewSheet } from './review-sheet';
import { TaskReviewPage } from './task-review-page';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentSummary, ReviewQueueItem, TaskDetails } from '../data-access/homework.models';
import { isDone } from '../homework-labels';
import { T } from '../i18n/texts';
import { AssignmentsReview } from './list/assignments-review';
import { AssignmentsTable, Line, Section } from './list/assignments-table';
import { WhomFilter } from './list/whom-filter';

/** How many finished assignments «Готовые» shows at a time. */
const DONE_PAGE = 20;

/** What the list shows: assignments in progress, drafts (not given yet) or finished ones. */
type Filter = 'active' | 'drafts' | 'done';

/** What the page shows: the list of assignments or the journal of students by assignments. */
type View = 'list' | 'journal';
const VIEWS: readonly View[] = ['list', 'journal'];

/**
 * Teacher: homework on the full width of the window. The review strip («Ждут проверки»: the latest works
 * handed in, «Проверить» opens one, «Проверить все подряд» starts the queue); one toolbar (search, «Кому»,
 * «Активные · Черновики · Готовые»); the assignments grouped by the due date, as a table from medium and as
 * cards on a phone. An assignment (`/teacher/homework/:assignmentId`) and a work
 * (`/teacher/homework/tasks/:taskId`) are pages of their own, «back» leads to the list; «⋮» of an
 * assignment — its actions.
 */
@Component({
  selector: 'tb-assignments-page',
  imports: [
    NgTemplateOutlet,
    AssignmentPage,
    AssignmentsReview,
    AssignmentsTable,
    Button,
    EmptyState,
    FilterChips,
    HelpButton,
    JournalView,
    LoadStateView,
    Pane,
    PageHeader,
    Panes,
    ReactiveFormsModule,
    ReviewSheet,
    SearchField,
    SegmentGroup,
    Select,
    Menu,
    TaskReviewPage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (taskId(); as id) {
      <tb-panes>
        <tb-pane [label]="t.title">
          <tb-task-review-page
            [taskId]="id"
            [single]="true"
            [back]="origin()"
            [sheet]="sheetOpen() || phoneReview()"
            [toolbar]="phoneReview()"
            [update]="decided()"
            [place]="place()"
            [total]="line().length"
            [previous]="previous()"
            [next]="next()"
            (loaded)="current.set($event)"
            (opened)="openWork($event)"
            (reviewed)="decide($event)"
          />
        </tb-pane>
        @if (sheetOpen() && reviewing(); as task) {
          <tb-pane kind="sheet" [label]="t.reviewSheet">
            <tb-review-sheet
              [task]="task"
              [next]="next()"
              (reviewed)="decide($event)"
              (closed)="closeReview()"
            />
          </tb-pane>
        }
      </tb-panes>
      @if (phoneReview() && reviewing(); as task) {
        <!-- a phone: the floating toolbar and the comment in a bottom sheet, no bottom bar (spec §9) -->
        <tb-review-sheet
          [compact]="true"
          [task]="task"
          [next]="next()"
          (reviewed)="decide($event)"
          (closed)="closeReview()"
        />
      }
    } @else if (assignmentId(); as id) {
      <tb-panes>
        <tb-pane [label]="t.title">
          <tb-assignment-page
            [assignmentId]="id"
            [single]="true"
            (changed)="refresh()"
            (reviewWork)="startReview($event, id)"
          />
        </tb-pane>
      </tb-panes>
    } @else {
      <tb-panes>
        <tb-pane [label]="t.title">
          <div tbPaneHeader>
            <tb-page-header [title]="t.title">
              <tb-help-button help topic="teacher/homework" />
              @if (!mobile()) {
                <tb-segment-group
                  class="tb-hw__views"
                  [label]="journalT.view"
                  [outlined]="true"
                  [segments]="viewSegments()"
                  [value]="view()"
                  (valueChange)="setView($event)"
                />
              }
              @if (mobile()) {
                <p-button
                  class="tb-page-fab"
                  [label]="t.createShort"
                  icon="tb-i tb-i-add"
                  (onClick)="openCreate()"
                />
              } @else {
                <p-button [label]="t.create" icon="tb-i tb-i-add" (onClick)="openCreate()" />
              }
            </tb-page-header>

            @if (view() === 'list') {
              <div class="tb-toolbar tb-hw__toolbar">
                <tb-search-field [formControl]="search" [label]="t.search" />
                @if (mobile()) {
                  <!-- one row of chips, «Кому» a chip with a menu (M3 dropdown chip) -->
                  <tb-filter-chips
                    [label]="t.filters"
                    [chips]="chips()"
                    [scrollable]="true"
                    [menu]="who.chip()"
                    [(value)]="filter"
                  />
                } @else {
                  <ng-container [ngTemplateOutlet]="whomSelect" />
                  <tb-segment-group
                    [label]="t.filters"
                    [outlined]="true"
                    [checkmark]="false"
                    [segments]="segments()"
                    [(value)]="filter"
                  />
                }
              </div>
            }
          </div>
          @if (view() === 'journal') {
            <tb-journal-view
              [who]="who.id()"
              (review)="startReview($event)"
              (openAssignment)="openAssignment($event)"
            >
              <div whom>
                @if (mobile()) {
                  <tb-filter-chips
                    [label]="t.whom"
                    [chips]="[]"
                    [menu]="who.chip()"
                    [value]="filter()"
                  />
                } @else {
                  <ng-container [ngTemplateOutlet]="whomSelect" />
                }
              </div>
            </tb-journal-view>
          } @else {
            <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
              @if (works().length > 0) {
                <tb-assignments-review
                  [works]="works()"
                  [waiting]="waitingCount()"
                  [now]="now()"
                  (review)="startReview($event)"
                  (reviewAll)="reviewAll()"
                />
              }

              @if (lines().length === 0) {
                <ng-container [ngTemplateOutlet]="empty" />
              } @else {
                <tb-assignments-table
                  [sections]="sections()"
                  [lines]="lines()"
                  [mobile]="mobile()"
                  [medium]="medium()"
                  [now]="now()"
                  [menuFor]="menuFor()?.id ?? null"
                  (menu)="openMenu($event.assignment, $event.event)"
                />
                <ng-container [ngTemplateOutlet]="showMore" />
              }
            </tb-load-state>
          }
        </tb-pane>
      </tb-panes>
    }

    <!-- «Кому»: an M3 outlined select of 40 dp, as high as the segmented buttons beside it -->
    <ng-template #whomSelect>
      <span class="tb-hw__select">
        <i class="tb-i tb-i-person" aria-hidden="true"></i>
        <p-select
          [formControl]="whom"
          [options]="who.options()"
          [group]="true"
          optionGroupLabel="label"
          optionGroupChildren="items"
          optionLabel="label"
          optionValue="value"
          [placeholder]="t.whomAll"
          [showClear]="true"
          [ariaLabel]="t.whom"
          appendTo="body"
        />
      </span>
    </ng-template>

    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />

    <ng-template #showMore>
      @if (filter() === 'done' && finished().length > shownDone().length) {
        <p-button
          [label]="t.showMore"
          [text]="true"
          severity="secondary"
          (onClick)="doneLimit.update((limit) => limit + donePage)"
        />
      }
    </ng-template>

    <ng-template #empty>
      @if (assignments().length === 0) {
        <tb-empty-state icon="tb-i-assignment" [title]="t.emptyTitle" [hint]="t.emptyHint" />
      } @else if (searching()) {
        <tb-empty-state icon="tb-i-search" [title]="t.notFoundTitle" [hint]="t.notFoundHint" />
      } @else if (filter() === 'done') {
        <tb-empty-state icon="tb-i-check_circle" [title]="t.noDoneTitle" [hint]="t.noDoneHint" />
      } @else if (filter() === 'drafts') {
        <tb-empty-state icon="tb-i-assignment" [title]="t.noDraftsTitle" [hint]="t.noDraftsHint" />
      } @else {
        <tb-empty-state icon="tb-i-assignment" [title]="t.noActiveTitle" [hint]="t.noActiveHint" />
      }
    </ng-template>
  `,
  styles: `
    .tb-hw__views {
      flex: 0 0 auto;
    }

    /* «Кому»: M3 outlined select, 40 dp like the segmented buttons beside it, a leading person icon */
    .tb-hw__select {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .tb-hw__select > i {
      position: absolute;
      inset-inline-start: var(--tb-space-3);
      z-index: 1;
      color: var(--p-md-on-surface-variant);
      font-size: 1.125rem;
      pointer-events: none;
    }

    :host ::ng-deep .tb-hw__select .p-select {
      box-sizing: border-box;
      block-size: 2.5rem;
      min-inline-size: 12rem;
      border: 1px solid var(--p-md-outline);
      border-radius: var(--tb-shape-sm);
      background: transparent;
      box-shadow: none;
    }

    :host ::ng-deep .tb-hw__select .p-select-label {
      padding-block: 0;
      padding-inline: 2.5rem var(--tb-space-2);
      font: var(--tb-type-body-m);
      line-height: 2.25rem;
    }

    /* the search takes the free room, «Кому» and the filter after it (ADR-0018) */
    .tb-hw__toolbar {
      margin-block-start: var(--tb-space-4);
    }

    .tb-hw__toolbar tb-search-field {
      flex: 1 1 16rem;
    }

    @media (width < 37.5em) {
      .tb-hw__toolbar {
        flex-direction: column;
        align-items: stretch;
        gap: var(--tb-space-3);
      }

      /* the 16rem basis is for the row; in a column it would be the height */
      .tb-hw__toolbar tb-search-field {
        flex: none;
      }
    }
  `,
})
export class AssignmentsPage implements OnInit {
  protected readonly mobile = injectMobile();
  protected readonly t = T.list;
  protected readonly journalT = T.journal;
  /** Route parameters: the work or the assignment that takes the place of the list. */
  readonly taskId = input<string>();
  readonly assignmentId = input<string>();
  private readonly api = inject(HomeworkApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackbar = inject(Snackbar);
  private readonly rail = inject(RailState);
  private readonly menu = viewChild.required<Menu>('menu');

  /** The row whose «⋮» menu is open: one popup menu serves every row. */
  protected readonly menuFor = signal<AssignmentSummary | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const assignment = this.menuFor();
    return assignment === null
      ? []
      : [
          {
            label: T.copy.action,
            icon: 'tb-i tb-i-content_copy',
            command: () => {
              this.copy(assignment);
            },
          },
        ];
  });

  private readonly size = injectWindowSize();
  /** Medium (600–839): the list is tiles with the bar, not the table. */
  protected readonly medium = computed(() => this.size() === 'medium');
  /** The work the page has read: the side sheet reviews it. */
  protected readonly current = signal<TaskDetails | null>(null);
  /** The work as a decision of the sheet left it: the page shows it. */
  protected readonly decided = signal<TaskDetails | null>(null);
  /** The open work, once it is read and can be reviewed. */
  protected readonly reviewing = computed(() => {
    const task = this.current();
    return task !== null &&
      task.taskId === this.taskId() &&
      (task.status === 'SUBMITTED' || task.status === 'ACCEPTED')
      ? task
      : null;
  });
  /** From large the review is a side sheet beside the work (sketch 14); the rail gives it room. */
  protected readonly sheetOpen = computed(
    () => (this.size() === 'large' || this.size() === 'extra-large') && this.reviewing() !== null,
  );
  /** The work of the review on a phone (compact): the floating toolbar, no bottom bar (spec §9). */
  protected readonly phoneReview = computed(
    () => this.size() === 'compact' && this.reviewing() !== null,
  );
  /** «1 из 3»: the place of the open work in the queue (0: it is not in it). */
  protected readonly place = computed(
    () => this.line().findIndex((work) => work.taskId === this.taskId()) + 1,
  );
  /** The assignment whose works the review goes through; `null` — all works waiting. */
  protected readonly scope = signal<string | null>(null);
  /** The queue of the review: the chosen assignment's works or all of them. */
  protected readonly line = computed(() => {
    const scope = this.scope();
    return scope === null
      ? this.queue()
      : this.queue().filter((work) => work.assignmentId === scope);
  });
  /** Where «Назад» and the end of the queue lead: the assignment it started from, else the list. */
  protected readonly origin = computed(() => {
    const scope = this.scope();
    return scope === null ? ['/teacher/homework'] : ['/teacher/homework', scope];
  });
  /** The work after the open one (the first one when it is the last); none when it is the only one. */
  /** The work before the open one in the queue. */
  protected readonly previous = computed(() => {
    const queue = this.line();
    const index = queue.findIndex((work) => work.taskId === this.taskId());
    return index > 0 ? (queue[index - 1]?.taskId ?? null) : null;
  });
  protected readonly next = computed<NextWork | null>(() => {
    const queue = this.line();
    const index = queue.findIndex((work) => work.taskId === this.taskId());
    const work = queue[index + 1] ?? queue.find((other) => other.taskId !== this.taskId());
    return work === undefined ? null : { taskId: work.taskId, studentName: work.studentName };
  });

  protected readonly assignments = signal<AssignmentSummary[]>([]);
  protected readonly queue = signal<ReviewQueueItem[]>([]);
  protected readonly state = new LoadState();
  /** The moment the lists were read: a due date before it is overdue. */
  protected readonly now = signal(Date.now());
  /** The search is kept in the address (`?q=`): «Назад» from an assignment and a reload bring it back. */
  protected readonly search = new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', {
    nonNullable: true,
  });
  private readonly query = toSignal(this.search.valueChanges, {
    initialValue: this.search.value,
  });
  protected readonly searching = computed(() => this.query().trim() !== '');
  protected readonly filter = signal<Filter>('active');
  /** «Списком» or «По ученикам»; kept in the address (`?view=journal`). */
  protected readonly view = signal<View>(readQuery(this.route, 'view', VIEWS) ?? 'list');
  protected readonly viewSegments = computed<Segment<View>[]>(() => [
    { value: 'list', label: T.journal.asList, icon: 'tb-i tb-i-view_list' },
    { value: 'journal', label: T.journal.byStudents, icon: 'tb-i tb-i-grid_view' },
  ]);

  /** What the search finds: the title or a name of a student of the assignment. */
  private matches(assignment: AssignmentSummary): boolean {
    const query = this.query().trim().toLocaleLowerCase();
    return (
      query === '' ||
      assignment.title.toLocaleLowerCase().includes(query) ||
      assignment.students.some((name) => name.toLocaleLowerCase().includes(query))
    );
  }

  /** «Кому» is kept in the address (`?who=student:<id>` / `group:<id>`), like the search. */
  protected readonly who = new WhomFilter(this.route.snapshot.queryParamMap.get('who'));
  readonly whom = this.who.control;

  private readonly found = computed(() => {
    const ids = this.who.ids();
    return this.assignments().filter(
      (a) => this.matches(a) && (ids === null || a.studentIds.some((id) => ids.has(id))),
    );
  });
  /** Works handed in whose assignment, student or title has the search text. */
  protected readonly works = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    const ids = this.who.ids();
    return this.queue().filter(
      (work) =>
        (ids === null || ids.has(work.studentId)) &&
        (query === '' ||
          work.title.toLocaleLowerCase().includes(query) ||
          work.studentName.toLocaleLowerCase().includes(query)),
    );
  });
  /** Works somebody still has to hand in (or hand in again): «Ещё N работ ждут сдачи». */
  protected readonly waitingCount = computed(() =>
    this.found().reduce((sum, assignment) => sum + assignment.assigned + assignment.returned, 0),
  );
  /** Given to somebody, not all the work accepted yet. */
  private readonly given = computed(() =>
    this.found().filter((assignment) => assignment.totalTasks > 0 && !isDone(assignment)),
  );
  /** Not given to anybody yet. */
  private readonly drafts = computed(() =>
    this.found().filter((assignment) => assignment.totalTasks === 0),
  );
  /** Every task of the assignment is accepted («Принято»). */
  protected readonly finished = computed(() => this.found().filter(isDone));
  protected readonly donePage = DONE_PAGE;
  protected readonly doneLimit = signal(DONE_PAGE);
  protected readonly shownDone = computed(() => this.finished().slice(0, this.doneLimit()));

  /** The rows of the chosen filter; «Активные» by the due date, the others in one run. */
  protected readonly sections = computed<readonly Section[]>(() => {
    switch (this.filter()) {
      case 'active':
        return groupByDeadline(this.given(), new Date(this.now())).map((group) => ({
          key: group.key,
          title: this.t.groupCount(this.groupLabel(group.key), group.rows.length),
          rows: group.rows,
        }));
      case 'drafts':
        return this.drafts().length === 0 ? [] : [{ key: null, title: null, rows: this.drafts() }];
      case 'done':
        return this.shownDone().length === 0
          ? []
          : [{ key: null, title: null, rows: this.shownDone() }];
    }
  });
  /** The table: a heading line before the rows of each group. */
  protected readonly lines = computed<Line[]>(() =>
    this.sections().flatMap((section) => [
      ...(section.title === null ? [] : [{ section, assignment: null }]),
      ...section.rows.map((assignment) => ({ section, assignment })),
    ]),
  );

  private groupLabel(key: DeadlineKey): string {
    return key === 'overdue'
      ? this.t.late
      : key === 'week'
        ? this.t.weekGroup
        : key === 'later'
          ? this.t.laterGroup
          : this.t.noneGroup;
  }

  private readonly counts = computed(() => ({
    active: this.assignments().filter((a) => a.totalTasks > 0 && !isDone(a)).length,
    drafts: this.assignments().filter((a) => a.totalTasks === 0).length,
    done: this.assignments().filter(isDone).length,
  }));
  protected readonly segments = computed<Segment<Filter>[]>(() => [
    { value: 'active', label: this.t.active, count: this.counts().active },
    { value: 'drafts', label: this.t.drafts, count: this.counts().drafts },
    { value: 'done', label: this.t.ready, count: this.counts().done },
  ]);
  protected readonly chips = computed<FilterChip<Filter>[]>(() => this.segments());

  constructor() {
    collapseRail(() => this.sheetOpen());
    // a phone: the view switch is one icon of the top app bar (the work under review has its own toolbar)
    effect(() => {
      const journal = this.view() === 'journal';
      this.rail.compactBar.set(
        this.mobile() && !this.taskId() && !this.assignmentId()
          ? {
              title: this.t.title,
              actions: [
                {
                  icon: journal ? 'view_list' : 'grid_view',
                  label: journal ? this.journalT.switchToList : this.journalT.switchToJournal,
                  command: () => {
                    this.setView(journal ? 'list' : 'journal');
                  },
                },
              ],
              menu: [],
              menuLabel: '',
            }
          : null,
      );
    });
    inject(DestroyRef).onDestroy(() => {
      this.rail.compactBar.set(null);
    });
    hideBottomBar(() => this.phoneReview());
    this.search.valueChanges.pipe(takeUntilDestroyed()).subscribe((text) => {
      writeQuery(this.router, this.route, { q: text.trim() });
    });
    this.whom.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      writeQuery(this.router, this.route, { who: value });
    });
    // the editor takes the place of `?create=` in the history
    openOnCreate(
      'assignment',
      () => {
        this.openCreate(true);
      },
      false,
    );
  }

  ngOnInit(): void {
    this.load();
    this.who.load();
  }

  protected setView(view: View): void {
    this.view.set(view);
    writeQuery(this.router, this.route, { view: view === 'list' ? null : view });
  }

  protected openAssignment(id: string): void {
    void this.router.navigate(['/teacher/homework', id]);
  }

  /** A review starts from a work: the queue is all works waiting, or the works of one assignment. */
  protected startReview(taskId: string, assignmentId: string | null = null): void {
    this.scope.set(assignmentId);
    this.openWork(taskId);
  }

  protected openWork(taskId: string): void {
    void this.router.navigate(['/teacher/homework/tasks', taskId]);
  }

  /** «Проверить все подряд»: the oldest work opens, a decision leads to the next one. */
  protected reviewAll(): void {
    const first = this.works()[0];
    if (first !== undefined) {
      this.startReview(first.taskId);
    }
  }

  protected closeReview(): void {
    void this.router.navigate(this.origin());
  }

  /** A decision: the next work of the queue opens; with none left (or the work was not in the queue) the list stays. */
  protected decide(task: TaskDetails): void {
    const next = this.place() > 0 ? this.next() : null;
    this.decided.set(task);
    this.refresh();
    if (next !== null) {
      this.openWork(next.taskId);
    } else if (this.place() > 0) {
      this.closeReview();
      this.snackbar.success(T.review.allDone);
    }
  }

  protected openMenu(assignment: AssignmentSummary, event: Event): void {
    this.menuFor.set(assignment);
    this.menu().toggle(event);
  }

  /** A draft copy: the list reads itself again and the editor of the copy opens. */
  private copy(assignment: AssignmentSummary): void {
    this.api.copyAssignment(assignment.id).subscribe((copy) => {
      this.snackbar.success(T.copy.copied(copy.title));
      this.refresh();
      void this.router.navigate(['/teacher/homework', copy.id, 'edit']);
    });
  }

  /** «Новое задание»: the editor of a new assignment (one creation form, 352.6). */
  protected openCreate(replaceUrl = false): void {
    void this.router.navigate(['/teacher/homework/new'], { replaceUrl });
  }

  /** A work was reviewed or an assignment changed: reads the lists again without the loading state. */
  protected refresh(): void {
    forkJoin({ assignments: this.api.assignments(), queue: this.api.reviewQueue() }).subscribe(
      ({ assignments, queue }) => {
        this.now.set(Date.now());
        this.assignments.set(assignments);
        this.queue.set(queue);
      },
    );
  }

  protected load(): void {
    forkJoin({ assignments: this.api.assignments(), queue: this.api.reviewQueue() })
      .pipe(this.state.track())
      .subscribe(({ assignments, queue }) => {
        this.now.set(Date.now());
        this.assignments.set(assignments);
        this.queue.set(queue);
      });
  }
}
