import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { injectMobile, injectWindowSize } from '@core/layout/mobile';
import { collapseRail, hideBottomBar } from '@core/layout/rail-state';
import { Snackbar } from '@core/snackbar/snackbar';
import { openOnCreate } from '@core/routing/create-param';
import { writeQuery } from '@core/routing/query-state';
import { HelpButton } from '@features/help/parts';
import { TeacherColors } from '@features/identity/parts';
import { Avatar } from '@shared/ui/avatar';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';
import { SearchField } from '@shared/ui/search-field';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';
import { AssignmentPage } from './assignment-page';
import { NextWork, ReviewSheet } from './review-sheet';
import { TaskReviewPage } from './task-review-page';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentSummary, ReviewQueueItem, TaskDetails } from '../data-access/homework.models';
import { assignmentProgress, isDone } from '../homework-labels';
import { T } from '../i18n/texts';

/** Names a row shows in full; more of them — the first one and «и ещё N» (one row keeps its height). */
const SHOWN_STUDENTS = 2;

/** What the list shows: works to review, assignments in progress (with the drafts) or finished ones. */
type Filter = 'review' | 'active' | 'done';

/**
 * Teacher: homework as the list pane of a list-detail (redesign spec §9): the connected group
 * «На проверку · Активные · Готовые» with the counts, a persistent search above the list, the
 * rows on the pane's surface. «На проверку» lists the works handed in (then «Ждут сдачи»: the assignments
 * somebody still has to hand in), «Активные» the assignments in progress (then «Не выдано»: the drafts),
 * «Готовые» those with every work accepted. A row opens the work or the assignment; «⋮» of an assignment —
 * its actions. The detail pane is the work (`/teacher/homework/tasks/:taskId`) or the assignment with its
 * students (`/teacher/homework/:assignmentId`); on one pane the route decides what is shown, «back» leads to the list.
 */
@Component({
  selector: 'tb-assignments-page',
  imports: [
    NgTemplateOutlet,
    AssignmentPage,
    Avatar,
    Button,
    EmptyState,
    HelpButton,
    LoadStateView,
    Pane,
    PageHeader,
    Panes,
    ReactiveFormsModule,
    ReviewSheet,
    RouterLink,
    SearchField,
    SegmentGroup,
    Tag,
    Tooltip,
    ButtonAttributes,
    Menu,
    TaskReviewPage,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      @if (layout.list()) {
        <tb-pane kind="fixed" [label]="t.title">
          <div tbPaneHeader>
            <tb-page-header [title]="t.title">
              <tb-help-button help topic="teacher/homework" />
              <!-- wider, the rail's «Создать» is the page's FAB (spec §1 principle 5) -->
              @if (mobile()) {
                <p-button
                  class="tb-page-fab"
                  [label]="t.create"
                  icon="tb-i tb-i-add"
                  (onClick)="openCreate()"
                />
              }
            </tb-page-header>

            <div class="tb-hw__filters">
              <tb-segment-group [label]="t.filters" [segments]="segments()" [(value)]="filter" />
              <tb-search-field [formControl]="search" [label]="t.search" />
            </div>
          </div>
          <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
            @switch (filter()) {
              @case ('review') {
                @if (works().length > 0) {
                  <ul class="tb-list tb-list--clamp" [attr.aria-label]="t.toReview">
                    @for (work of works(); track work.taskId) {
                      <li [class.tb-list__item--current]="taskId() === work.taskId">
                        <tb-avatar
                          [attr.data-tb-label]="colors.studentLabel(work.studentId)"
                          [name]="work.studentName"
                          [photo]="work.studentAvatar"
                        />
                        <div class="tb-list__text">
                          <a
                            class="tb-list__title tb-list__link"
                            [routerLink]="['/teacher/homework/tasks', work.taskId]"
                            [attr.aria-current]="taskId() === work.taskId ? 'page' : null"
                            [attr.aria-label]="t.reviewOf(work.studentName, work.title)"
                            >{{ work.studentName }}</a
                          >
                          <span class="tb-list__supporting">{{ handedIn(work) }}</span>
                        </div>
                        @if (isLate(work)) {
                          <div class="tb-list__trail">
                            <p-tag [value]="t.late" severity="danger" />
                          </div>
                        }
                      </li>
                    }
                  </ul>
                } @else if (!searching() && waiting().length === 0) {
                  <tb-empty-state
                    icon="tb-i-check_circle"
                    [title]="t.allReviewedTitle"
                    [hint]="t.allReviewedHint"
                  />
                } @else if (searching()) {
                  <ng-container [ngTemplateOutlet]="notFound" />
                }
                @if (waiting().length > 0) {
                  <h2 class="tb-hw__section">{{ t.waiting }}</h2>
                  <ng-container
                    [ngTemplateOutlet]="assignmentRows"
                    [ngTemplateOutletContext]="{ rows: waiting(), label: t.waiting }"
                  />
                }
              }
              @case ('active') {
                @if (given().length > 0) {
                  <ng-container
                    [ngTemplateOutlet]="assignmentRows"
                    [ngTemplateOutletContext]="{ rows: given(), label: t.active }"
                  />
                } @else if (drafts().length === 0) {
                  <ng-container
                    [ngTemplateOutlet]="empty"
                    [ngTemplateOutletContext]="{ done: false }"
                  />
                }
                @if (drafts().length > 0) {
                  <h2 class="tb-hw__section">{{ t.drafts }}</h2>
                  <ng-container
                    [ngTemplateOutlet]="assignmentRows"
                    [ngTemplateOutletContext]="{ rows: drafts(), label: t.drafts }"
                  />
                }
              }
              @case ('done') {
                @if (finished().length > 0) {
                  <ng-container
                    [ngTemplateOutlet]="assignmentRows"
                    [ngTemplateOutletContext]="{ rows: finished(), label: t.done }"
                  />
                } @else {
                  <ng-container
                    [ngTemplateOutlet]="empty"
                    [ngTemplateOutletContext]="{ done: true }"
                  />
                }
              }
            }
          </tb-load-state>
        </tb-pane>
      }
      @if (layout.detail()) {
        <tb-pane [label]="t.pickTitle">
          @if (taskId(); as id) {
            <tb-task-review-page
              [taskId]="id"
              [single]="layout.single()"
              [sheet]="sheetOpen() || phoneReview()"
              [toolbar]="phoneReview()"
              [update]="decided()"
              (loaded)="current.set($event)"
              (changed)="refresh()"
            />
          } @else if (assignmentId(); as id) {
            <tb-assignment-page
              [assignmentId]="id"
              [single]="layout.single()"
              (changed)="refresh()"
            />
          } @else {
            <tb-empty-state icon="tb-i-assignment" [title]="t.pickTitle" [hint]="t.pickHint" />
          }
        </tb-pane>
      }
      @if (sheetOpen() && reviewing(); as task) {
        <tb-pane kind="sheet" [label]="t.reviewSheet">
          <tb-review-sheet
            [task]="task"
            [place]="place()"
            [total]="queue().length"
            [next]="next()"
            (reviewed)="decide($event)"
            (opened)="openWork($event)"
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
        [place]="place()"
        [total]="queue().length"
        [next]="next()"
        (reviewed)="decide($event)"
        (opened)="openWork($event)"
        (closed)="closeReview()"
      />
    }

    <ng-template #assignmentRows let-rows="rows" let-label="label">
      <ul class="tb-list tb-list--clamp" [attr.aria-label]="label">
        @for (assignment of rows; track assignment.id) {
          <li [class.tb-list__item--current]="assignmentId() === assignment.id">
            <span class="tb-list__lead" aria-hidden="true"
              ><i
                [class]="
                  assignment.boardId === null ? 'tb-i tb-i-assignment' : 'tb-i tb-i-co_present'
                "
              ></i
            ></span>
            <div class="tb-list__text">
              <a
                class="tb-list__title tb-list__link"
                [routerLink]="['/teacher/homework', assignment.id]"
                [attr.aria-current]="assignmentId() === assignment.id ? 'page' : null"
                >{{ assignment.title }}</a
              >
              <span class="tb-list__supporting">{{ details(assignment) }}</span>
            </div>
            <div class="tb-list__trail tb-list__trail--icons tb-hw__row-end">
              @if (filter() === 'review') {
                @if (isOverdue(assignment)) {
                  <p-tag [value]="t.late" severity="danger" />
                } @else {
                  <span class="tb-muted">{{
                    t.handedOf(assignment.submitted + assignment.accepted, assignment.totalTasks)
                  }}</span>
                }
              } @else if (progress(assignment); as badge) {
                <p-tag [value]="badge.label" [severity]="badge.severity" />
              }
              <p-button
                icon="tb-i tb-i-more_vert"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [pTooltip]="t.actions(assignment.title)"
                [ariaLabel]="t.actions(assignment.title)"
                [tbAttributes]="{
                  'aria-haspopup': 'menu',
                  'aria-expanded': menuFor()?.id === assignment.id ? 'true' : 'false',
                }"
                (onClick)="openMenu(assignment, $event)"
              />
            </div>
          </li>
        }
      </ul>
    </ng-template>

    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />

    <ng-template #empty let-done="done">
      @if (assignments().length === 0) {
        <tb-empty-state icon="tb-i-assignment" [title]="t.emptyTitle" [hint]="t.emptyHint" />
      } @else if (searching()) {
        <ng-container [ngTemplateOutlet]="notFound" />
      } @else if (done) {
        <tb-empty-state icon="tb-i-check_circle" [title]="t.noDoneTitle" [hint]="t.noDoneHint" />
      } @else {
        <tb-empty-state icon="tb-i-assignment" [title]="t.noActiveTitle" [hint]="t.noActiveHint" />
      }
    </ng-template>

    <ng-template #notFound>
      <tb-empty-state icon="tb-i-search" [title]="t.notFoundTitle" [hint]="t.notFoundHint" />
    </ng-template>
  `,
  styles: `
    .tb-list__trail {
      flex-direction: column;
      align-items: flex-start;
    }

    /* the badge and «⋮» side by side (the review rows keep the column) */
    .tb-hw__row-end {
      flex-direction: row;
      align-items: center;
    }

    /* from expanded the pane does not scroll as a whole: its list does (our decision, as the students' list) */
    .tb-hw__filters {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-4);
    }

    /* «Ждут сдачи», «Не выдано»: a label over the rows on the pane's surface (M3 \`label medium\`) */
    .tb-hw__section {
      margin: var(--tb-space-5) 0 var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
  `,
})
export class AssignmentsPage implements OnInit {
  protected readonly mobile = injectMobile();
  protected readonly t = T.list;
  protected readonly colors = inject(TeacherColors);
  protected readonly progress = assignmentProgress;
  /** Route parameters: the work or the assignment open beside the list. */
  readonly taskId = input<string>();
  readonly assignmentId = input<string>();
  protected readonly layout = injectListDetail(
    () => this.taskId() !== undefined || this.assignmentId() !== undefined,
  );
  private readonly api = inject(HomeworkApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackbar = inject(Snackbar);
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
  private readonly dates = new DatePipe(inject(LOCALE_ID));

  private readonly size = injectWindowSize();
  /** The work the detail pane has read: the side sheet reviews it. */
  protected readonly current = signal<TaskDetails | null>(null);
  /** The work as a decision of the sheet left it: the detail pane shows it. */
  protected readonly decided = signal<TaskDetails | null>(null);
  /** The work open beside the list, once it is read and can be reviewed. */
  protected readonly reviewing = computed(() => {
    const task = this.current();
    return task !== null &&
      task.taskId === this.taskId() &&
      (task.status === 'SUBMITTED' || task.status === 'ACCEPTED')
      ? task
      : null;
  });
  /** The review is the third pane of the extra-large window (spec §9); the rail gives it room. */
  protected readonly sheetOpen = computed(
    () => this.size() === 'extra-large' && this.reviewing() !== null,
  );
  /** The work of the review on a phone (compact, one pane): the floating toolbar, no bottom bar (spec §9). */
  protected readonly phoneReview = computed(
    () => this.size() === 'compact' && this.layout.single() && this.reviewing() !== null,
  );
  /** «1 из 3»: the place of the open work in the queue (0: it is not in it). */
  protected readonly place = computed(
    () => this.queue().findIndex((work) => work.taskId === this.taskId()) + 1,
  );
  /** The work after the open one (the first one when it is the last); none when it is the only one. */
  protected readonly next = computed<NextWork | null>(() => {
    const queue = this.queue();
    const index = queue.findIndex((work) => work.taskId === this.taskId());
    const work = queue[index + 1] ?? queue.find((other) => other.taskId !== this.taskId());
    return work === undefined ? null : { taskId: work.taskId, studentName: work.studentName };
  });

  protected readonly assignments = signal<AssignmentSummary[]>([]);
  protected readonly queue = signal<ReviewQueueItem[]>([]);
  protected readonly state = new LoadState();
  /** The moment the lists were read: a due date before it is overdue. */
  private readonly now = signal(Date.now());
  /** The search is kept in the address (`?q=`): «Назад» from an assignment and a reload bring it back. */
  protected readonly search = new FormControl(this.route.snapshot.queryParamMap.get('q') ?? '', {
    nonNullable: true,
  });
  private readonly query = toSignal(this.search.valueChanges, {
    initialValue: this.search.value,
  });
  protected readonly searching = computed(() => this.query().trim() !== '');
  /** The chosen filter; until one is chosen «На проверку» while there is work to review, else «Активные». */
  protected readonly filter = linkedSignal<Filter>(() =>
    this.queue().length > 0 ? 'review' : 'active',
  );

  /** What the search finds: the title or a name of a student of the assignment. */
  private matches(assignment: AssignmentSummary): boolean {
    const query = this.query().trim().toLocaleLowerCase();
    return (
      query === '' ||
      assignment.title.toLocaleLowerCase().includes(query) ||
      assignment.students.some((name) => name.toLocaleLowerCase().includes(query))
    );
  }

  private readonly found = computed(() => this.assignments().filter((a) => this.matches(a)));
  /** Works handed in whose assignment, student or title has the search text. */
  protected readonly works = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.queue().filter(
      (work) =>
        query === '' ||
        work.title.toLocaleLowerCase().includes(query) ||
        work.studentName.toLocaleLowerCase().includes(query),
    );
  });
  /** Given out and somebody still has to hand in (or hand in again). */
  protected readonly waiting = computed(() =>
    this.found().filter(
      (assignment) => assignment.assigned + assignment.returned > 0 && !isDone(assignment),
    ),
  );
  /** Given to somebody, not all the work accepted yet. */
  protected readonly given = computed(() =>
    this.found().filter((assignment) => assignment.totalTasks > 0 && !isDone(assignment)),
  );
  /** Not given to anybody yet. */
  protected readonly drafts = computed(() =>
    this.found().filter((assignment) => assignment.totalTasks === 0),
  );
  /** Every task of the assignment is accepted («Принято»). */
  protected readonly finished = computed(() => this.found().filter(isDone));

  protected readonly segments = computed<Segment<Filter>[]>(() => [
    { value: 'review', label: this.t.toReview, count: this.queue().length },
    {
      value: 'active',
      label: this.t.active,
      count: this.assignments().filter((assignment) => !isDone(assignment)).length,
    },
    { value: 'done', label: this.t.ready, count: this.assignments().filter(isDone).length },
  ]);

  constructor() {
    collapseRail(() => this.sheetOpen());
    hideBottomBar(() => this.phoneReview());
    this.search.valueChanges.pipe(takeUntilDestroyed()).subscribe((text) => {
      writeQuery(this.router, this.route, { q: text.trim() });
    });
    // the editor is a route of its own: it takes the place of the list in the history
    openOnCreate(
      'assignment',
      () => {
        void this.router.navigate(['/teacher/homework/new'], { replaceUrl: true });
      },
      false,
    );
  }

  ngOnInit(): void {
    this.load();
  }

  protected openWork(taskId: string): void {
    void this.router.navigate(['/teacher/homework/tasks', taskId]);
  }

  protected closeReview(): void {
    void this.router.navigate(['/teacher/homework']);
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

  protected openCreate(): void {
    void this.router.navigate(['/teacher/homework/new']);
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

  /** «Дроби · сдано 05.09 10:00». */
  protected handedIn(work: ReviewQueueItem): string {
    return work.submittedAt === null
      ? work.title
      : this.t.handedIn(work.title, this.dates.transform(work.submittedAt, 'dd.MM HH:mm') ?? '');
  }

  /** Handed in after the due date. */
  protected isLate(work: ReviewQueueItem): boolean {
    return work.dueAt !== null && work.submittedAt !== null && work.submittedAt > work.dueAt;
  }

  /** The due date has passed and somebody has not handed in yet. */
  protected isOverdue(assignment: AssignmentSummary): boolean {
    return (
      assignment.dueAt !== null &&
      new Date(assignment.dueAt).getTime() < this.now() &&
      assignment.assigned + assignment.returned > 0
    );
  }

  /** «Анна и ещё 3 · до 12.10 18:00»; the year only when it is not the current one. */
  protected details(assignment: AssignmentSummary): string {
    const names = assignment.students;
    const who =
      names.length === 0
        ? this.t.nobody
        : names.length > SHOWN_STUDENTS
          ? this.t.andMore(names[0] ?? '', names.length - 1)
          : names.join(', ');
    return `${who} · ${this.dueOf(assignment.dueAt)}`;
  }

  private dueOf(dueAt: string | null): string {
    if (dueAt === null) {
      return T.noDueDate;
    }
    const year = (moment: string | number): string | null => this.dates.transform(moment, 'yyyy');
    const format = year(dueAt) === year(this.now()) ? 'dd.MM HH:mm' : 'dd.MM.yyyy HH:mm';
    return this.t.until(this.dates.transform(dueAt, format) ?? '');
  }
}
