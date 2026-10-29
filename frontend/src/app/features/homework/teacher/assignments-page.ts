import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  input,
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
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { quietContext } from '@core/http/api-error.interceptor';
import { injectMobile, injectWindowSize } from '@core/layout/mobile';
import { collapseRail, hideBottomBar } from '@core/layout/rail-state';
import { Snackbar } from '@core/snackbar/snackbar';
import { openOnCreate } from '@core/routing/create-param';
import { writeQuery } from '@core/routing/query-state';
import { HelpButton } from '@features/help/parts';
import { IdentityApi, TeacherColors } from '@features/identity/parts';
import { Avatar } from '@shared/ui/avatar';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { EmptyState } from '@shared/ui/empty-state';
import { FilterChip, FilterChips } from '@shared/ui/filter-chips';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes } from '@shared/ui/panes';
import { RowType } from '@shared/ui/row-type.directive';
import { SearchField } from '@shared/ui/search-field';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';
import { AssignmentPage } from './assignment-page';
import { DeadlineKey, groupByDeadline } from './deadline-groups';
import { NextWork, ReviewSheet } from './review-sheet';
import { TaskReviewPage } from './task-review-page';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentSummary, ReviewQueueItem, TaskDetails } from '../data-access/homework.models';
import { assignmentProgress, isDone } from '../homework-labels';
import { T } from '../i18n/texts';

/** Names a row shows in full; more of them — the first one and «и ещё N» (one row keeps its height). */
const SHOWN_STUDENTS = 2;

/** How many finished assignments «Готовые» shows at a time. */
const DONE_PAGE = 20;

/** How many works of the review strip show their own card; the rest go to «Проверить все подряд». */
const SHOWN_WORKS = 3;

const DAY = 24 * 60 * 60 * 1000;

/** One student or one group in the «Кому» select: `student:<id>` or `group:<id>`. */
interface WhomOption {
  readonly label: string;
  readonly value: string;
}

/** What the list shows: assignments in progress, drafts (not given yet) or finished ones. */
type Filter = 'active' | 'drafts' | 'done';

/** A run of rows under one heading; `key` — the due-date group, `null` — the heading is left out. */
interface Section {
  readonly key: DeadlineKey | null;
  readonly title: string | null;
  readonly rows: readonly AssignmentSummary[];
}

/** A line of the table: a group heading or an assignment. */
interface Line {
  readonly section: Section;
  readonly assignment: AssignmentSummary | null;
}

/** An icon of a material of an assignment with how many there are (none — the board). */
interface Material {
  readonly icon: string;
  readonly label: string;
  readonly count: number | null;
}

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
    Avatar,
    Button,
    EmptyState,
    FilterChips,
    HelpButton,
    LoadStateView,
    Pane,
    PageHeader,
    Panes,
    ReactiveFormsModule,
    ReviewSheet,
    RouterLink,
    RowType,
    SearchField,
    SegmentGroup,
    Select,
    TableModule,
    Tag,
    Tooltip,
    ButtonAttributes,
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
            [sheet]="sheetOpen() || phoneReview()"
            [toolbar]="phoneReview()"
            [update]="decided()"
            (loaded)="current.set($event)"
            (changed)="refresh()"
          />
        </tb-pane>
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
    } @else if (assignmentId(); as id) {
      <tb-panes>
        <tb-pane [label]="t.title">
          <tb-assignment-page [assignmentId]="id" [single]="true" (changed)="refresh()" />
        </tb-pane>
      </tb-panes>
    } @else {
      <tb-panes>
        <tb-pane [label]="t.title">
          <div tbPaneHeader>
            <tb-page-header [title]="t.title">
              <tb-help-button help topic="teacher/homework" />
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

            <div class="tb-toolbar tb-hw__toolbar">
              <tb-search-field [formControl]="search" [label]="t.search" />
              @if (mobile()) {
                <tb-filter-chips [label]="t.filters" [chips]="chips()" [(value)]="filter" />
              }
              <p-select
                [formControl]="whom"
                [options]="whomOptions()"
                [group]="true"
                optionGroupLabel="label"
                optionGroupChildren="items"
                optionLabel="label"
                optionValue="value"
                [placeholder]="mobile() ? t.whomAll : t.everyone"
                [showClear]="true"
                [ariaLabel]="t.whom"
                appendTo="body"
                [fluid]="mobile()"
              />
              @if (!mobile()) {
                <tb-segment-group [label]="t.filters" [segments]="segments()" [(value)]="filter" />
              }
            </div>
          </div>
          <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
            @if (works().length > 0) {
              <section class="tb-hw__review" [attr.aria-label]="t.awaiting(works().length)">
                <div class="tb-hw__review-head">
                  <h2 class="tb-hw__label">{{ t.awaiting(works().length) }}</h2>
                  <p-button
                    [label]="t.checkAll"
                    icon="tb-i tb-i-arrow_forward"
                    iconPos="right"
                    [text]="true"
                    (onClick)="reviewAll()"
                  />
                </div>
                <ul class="tb-hw__cards">
                  @for (work of shownWorks(); track work.taskId) {
                    <li class="tb-hw__card">
                      <div class="tb-hw__card-head">
                        <tb-avatar
                          [attr.data-tb-label]="colors.studentLabel(work.studentId)"
                          [name]="work.studentName"
                          [photo]="work.studentAvatar"
                        />
                        <div class="tb-list__text">
                          <span class="tb-list__title">{{ work.studentName }}</span>
                          <span class="tb-list__supporting">{{ handedIn(work) }}</span>
                        </div>
                        @if (isLate(work)) {
                          <p-tag [value]="t.lateTag" severity="danger" />
                        }
                      </div>
                      <span class="tb-hw__card-task">{{ work.title }}</span>
                      <div class="tb-hw__card-foot">
                        @if (work.quizScore !== null && work.quizMax !== null) {
                          <p-tag
                            [value]="t.quizScore(work.quizScore, work.quizMax)"
                            severity="secondary"
                          />
                        }
                        <p-button
                          class="tb-hw__card-action"
                          [label]="t.check"
                          severity="secondary"
                          [ariaLabel]="t.reviewOf(work.studentName, work.title)"
                          (onClick)="openWork(work.taskId)"
                        />
                      </div>
                    </li>
                  }
                  @if (waitingCount() > 0) {
                    <li class="tb-hw__card tb-hw__card--waiting">
                      <i class="tb-i tb-i-hourglass_top" aria-hidden="true"></i>
                      {{ t.stillWaiting(waitingCount()) }}
                    </li>
                  }
                </ul>
              </section>
            }

            @if (lines().length === 0) {
              <ng-container [ngTemplateOutlet]="empty" />
            } @else if (mobile()) {
              @for (section of sections(); track section.key) {
                @if (section.title; as title) {
                  <h2
                    class="tb-hw__label tb-hw__group"
                    [class.tb-error]="section.key === 'overdue'"
                  >
                    {{ title }}
                  </h2>
                }
                <ul class="tb-list tb-list--clamp" [attr.aria-label]="section.title ?? t.title">
                  @for (assignment of section.rows; track assignment.id) {
                    <li>
                      <div class="tb-list__text">
                        <a
                          class="tb-list__title tb-list__link"
                          [routerLink]="['/teacher/homework', assignment.id]"
                          >{{ assignment.title }}</a
                        >
                        <span class="tb-list__supporting">{{ details(assignment) }}</span>
                        <ng-container
                          [ngTemplateOutlet]="handed"
                          [ngTemplateOutletContext]="{ assignment }"
                        />
                      </div>
                      <div class="tb-list__trail tb-list__trail--icons tb-hw__row-end">
                        @if (progress(assignment); as badge) {
                          <p-tag [value]="badge.label" [severity]="badge.severity" />
                        }
                        <ng-container
                          [ngTemplateOutlet]="rowMenu"
                          [ngTemplateOutletContext]="{ assignment }"
                        />
                      </div>
                    </li>
                  }
                </ul>
              }
              <ng-container [ngTemplateOutlet]="showMore" />
            } @else {
              <p-table [value]="lines()" styleClass="tb-cards tb-hw__table">
                <ng-template #header>
                  <tr>
                    <th class="tb-col-main">{{ t.columns.task }}</th>
                    <th>{{ t.columns.whom }}</th>
                    <th>{{ t.columns.due }}</th>
                    <th>{{ t.columns.handed }}</th>
                    <th>{{ t.columns.status }}</th>
                    <th>
                      <span class="tb-sr-only">{{ t.columns.actions }}</span>
                    </th>
                  </tr>
                </ng-template>
                <ng-template #body let-line [tbRowType]="lines()">
                  @if (line.assignment; as assignment) {
                    <tr>
                      <td>
                        <div class="tb-hw__task">
                          <span class="tb-list__lead" aria-hidden="true"
                            ><i
                              [class]="
                                assignment.boardId === null
                                  ? 'tb-i tb-i-assignment'
                                  : 'tb-i tb-i-co_present'
                              "
                            ></i
                          ></span>
                          <div class="tb-list__text">
                            <a
                              class="tb-list__title tb-link"
                              [routerLink]="['/teacher/homework', assignment.id]"
                              >{{ assignment.title }}</a
                            >
                            <span class="tb-hw__materials">
                              @for (material of materials(assignment); track material.icon) {
                                <span
                                  class="tb-hw__material"
                                  role="img"
                                  [attr.aria-label]="materialLabel(material)"
                                  [pTooltip]="materialLabel(material)"
                                >
                                  <i [class]="material.icon" aria-hidden="true"></i>
                                  @if (material.count !== null) {
                                    {{ material.count }}
                                  }
                                </span>
                              }
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="tb-hw__whom">
                          <i
                            [class]="
                              assignment.students.length > 1
                                ? 'tb-i tb-i-group'
                                : 'tb-i tb-i-person'
                            "
                            aria-hidden="true"
                          ></i>
                          {{ whomOf(assignment) }}
                        </span>
                      </td>
                      <td [class.tb-error]="isOverdue(assignment)">{{ due(assignment) }}</td>
                      <td>
                        <ng-container
                          [ngTemplateOutlet]="handed"
                          [ngTemplateOutletContext]="{ assignment }"
                        />
                      </td>
                      <td>
                        @if (progress(assignment); as badge) {
                          <p-tag [value]="badge.label" [severity]="badge.severity" />
                        }
                      </td>
                      <td>
                        <ng-container
                          [ngTemplateOutlet]="rowMenu"
                          [ngTemplateOutletContext]="{ assignment }"
                        />
                      </td>
                    </tr>
                  } @else {
                    <tr class="tb-hw__group-row">
                      <td colspan="6">
                        <h2 class="tb-hw__label" [class.tb-error]="line.section.key === 'overdue'">
                          {{ line.section.title }}
                        </h2>
                      </td>
                    </tr>
                  }
                </ng-template>
              </p-table>
              <ng-container [ngTemplateOutlet]="showMore" />
            }
          </tb-load-state>
        </tb-pane>
      </tb-panes>
    }

    <ng-template #handed let-assignment="assignment">
      @if (assignment.totalTasks > 0) {
        <span class="tb-hw__handed">
          <span
            class="tb-hw__bar"
            role="img"
            [attr.aria-label]="t.handedOf(handedCount(assignment), assignment.totalTasks)"
          >
            <span [style.inline-size.%]="share(assignment.accepted, assignment)"></span>
            <span
              class="tb-hw__bar-awaiting"
              [style.inline-size.%]="share(assignment.submitted, assignment)"
            ></span>
          </span>
          <span class="tb-muted">{{
            t.handedOf(handedCount(assignment), assignment.totalTasks)
          }}</span>
        </span>
      }
    </ng-template>

    <ng-template #rowMenu let-assignment="assignment">
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
      }
    }

    /* a label over a block (M3 \`label medium\`, upper case) */
    .tb-hw__label {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-hw__label.tb-error {
      color: var(--p-md-error);
    }

    .tb-hw__group {
      margin-block: var(--tb-space-5) var(--tb-space-2);
    }

    .tb-hw__review {
      margin-block-end: var(--tb-space-5);
    }

    .tb-hw__review-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-2);
    }

    /* the cards lie in a row; on a phone the row scrolls sideways */
    .tb-hw__cards {
      display: flex;
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      overflow-x: auto;
      list-style: none;
    }

    .tb-hw__card {
      display: flex;
      flex: 1 1 15rem;
      flex-direction: column;
      gap: var(--tb-space-3);
      min-inline-size: 15rem;
      max-inline-size: 22rem;
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--tb-list-item);
    }

    @media (width < 37.5em) {
      .tb-hw__card {
        flex: 0 0 15rem;
      }
    }

    .tb-hw__card--waiting {
      align-items: center;
      justify-content: center;
      border: 1px dashed var(--p-md-outline-variant);
      background: none;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      text-align: center;
    }

    .tb-hw__card-head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-hw__card-head .tb-list__text {
      flex: 1;
      min-inline-size: 0;
    }

    .tb-hw__card-task {
      font: var(--tb-type-title-s);
    }

    .tb-hw__card-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
      margin-block-start: auto;
    }

    .tb-hw__card-action {
      margin-inline-start: auto;
    }

    /* the group heading is not a tile; the tiles round their own corners again around it */
    .tb-hw__group-row > td {
      block-size: auto;
      padding-block: var(--tb-space-4) var(--tb-space-1);
    }

    :host ::ng-deep .tb-hw__table .p-datatable-tbody > tr.tb-hw__group-row + tr > td:first-child {
      border-start-start-radius: var(--tb-list-outer);
    }

    :host ::ng-deep .tb-hw__table .p-datatable-tbody > tr.tb-hw__group-row + tr > td:last-child {
      border-start-end-radius: var(--tb-list-outer);
    }

    :host
      ::ng-deep
      .tb-hw__table
      .p-datatable-tbody
      > tr:has(+ tr.tb-hw__group-row)
      > td:first-child {
      border-end-start-radius: var(--tb-list-outer);
    }

    :host
      ::ng-deep
      .tb-hw__table
      .p-datatable-tbody
      > tr:has(+ tr.tb-hw__group-row)
      > td:last-child {
      border-end-end-radius: var(--tb-list-outer);
    }

    .tb-hw__task {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-hw__materials {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-3);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-hw__material {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
    }

    .tb-hw__material i {
      font-size: 1rem;
    }

    .tb-hw__whom {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-hw__handed {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    /* accepted — the portal colour, handed in and waiting for review — tertiary */
    .tb-hw__bar {
      display: flex;
      inline-size: 7rem;
      block-size: 0.5rem;
      border-radius: var(--tb-shape-xs);
      background: var(--p-md-surface-container-highest);
      overflow: hidden;
    }

    .tb-hw__bar > span {
      background: var(--p-md-primary);
    }

    .tb-hw__bar > .tb-hw__bar-awaiting {
      background: var(--p-md-tertiary);
    }

    /* the badge and «⋮» side by side */
    .tb-hw__row-end {
      flex-direction: row;
      align-items: center;
    }
  `,
})
export class AssignmentsPage implements OnInit {
  protected readonly mobile = injectMobile();
  protected readonly t = T.list;
  protected readonly colors = inject(TeacherColors);
  protected readonly progress = assignmentProgress;
  /** Route parameters: the work or the assignment that takes the place of the list. */
  readonly taskId = input<string>();
  readonly assignmentId = input<string>();
  private readonly api = inject(HomeworkApi);
  private readonly identity = inject(IdentityApi);
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
  /** The review is the second pane of the extra-large window (spec §9); the rail gives it room. */
  protected readonly sheetOpen = computed(
    () => this.size() === 'extra-large' && this.reviewing() !== null,
  );
  /** The work of the review on a phone (compact): the floating toolbar, no bottom bar (spec §9). */
  protected readonly phoneReview = computed(
    () => this.size() === 'compact' && this.reviewing() !== null,
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
  protected readonly filter = signal<Filter>('active');

  /** What the search finds: the title or a name of a student of the assignment. */
  private matches(assignment: AssignmentSummary): boolean {
    const query = this.query().trim().toLocaleLowerCase();
    return (
      query === '' ||
      assignment.title.toLocaleLowerCase().includes(query) ||
      assignment.students.some((name) => name.toLocaleLowerCase().includes(query))
    );
  }

  /** The students and the groups of the «Кому» select. */
  private readonly students = signal<{ id: string; name: string }[]>([]);
  private readonly groups = signal<{ id: string; name: string; memberIds: string[] }[]>([]);
  /** «Кому» is kept in the address (`?who=student:<id>` / `group:<id>`), like the search. */
  readonly whom = new FormControl<string | null>(this.route.snapshot.queryParamMap.get('who'));
  private readonly whomValue = toSignal(this.whom.valueChanges, {
    initialValue: this.whom.value,
  });
  protected readonly whomOptions = computed(() => {
    const groups = this.groups().map((g): WhomOption => ({
      label: g.name,
      value: `group:${g.id}`,
    }));
    const students = this.students().map((s): WhomOption => ({
      label: s.name,
      value: `student:${s.id}`,
    }));
    return [
      ...(groups.length > 0 ? [{ label: this.t.groupsOption, items: groups }] : []),
      { label: this.t.studentsOption, items: students },
    ];
  });
  /** The ids of the students «Кому» stands for; `null` — everybody. */
  private readonly whomIds = computed<ReadonlySet<string> | null>(() => {
    const value = this.whomValue();
    if (value === null || value === '') {
      return null;
    }
    const id = value.slice(value.indexOf(':') + 1);
    return new Set(
      value.startsWith('group:')
        ? (this.groups().find((group) => group.id === id)?.memberIds ?? [])
        : [id],
    );
  });

  private readonly found = computed(() => {
    const ids = this.whomIds();
    return this.assignments().filter(
      (a) => this.matches(a) && (ids === null || a.studentIds.some((id) => ids.has(id))),
    );
  });
  /** Works handed in whose assignment, student or title has the search text. */
  protected readonly works = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    const ids = this.whomIds();
    return this.queue().filter(
      (work) =>
        (ids === null || ids.has(work.studentId)) &&
        (query === '' ||
          work.title.toLocaleLowerCase().includes(query) ||
          work.studentName.toLocaleLowerCase().includes(query)),
    );
  });
  protected readonly shownWorks = computed(() => this.works().slice(0, SHOWN_WORKS));
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
    hideBottomBar(() => this.phoneReview());
    this.search.valueChanges.pipe(takeUntilDestroyed()).subscribe((text) => {
      writeQuery(this.router, this.route, { q: text.trim() });
    });
    this.whom.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      writeQuery(this.router, this.route, { who: value });
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
    this.identity.listStudents(quietContext()).subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, name: student.displayName })),
      );
    });
    this.identity.listGroups(quietContext()).subscribe((groups) => {
      this.groups.set(
        groups
          .filter((group) => group.archivedAt === null)
          .map((group) => ({
            id: group.id,
            name: group.name,
            memberIds: group.members.map((member) => member.id),
          })),
      );
    });
  }

  protected openWork(taskId: string): void {
    void this.router.navigate(['/teacher/homework/tasks', taskId]);
  }

  /** «Проверить все подряд»: the oldest work opens, a decision leads to the next one. */
  protected reviewAll(): void {
    const first = this.works()[0];
    if (first !== undefined) {
      this.openWork(first.taskId);
    }
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

  /** «сдано сегодня, 09:12», «сдано вчера, 22:40», «сдано 05.09 10:00». */
  protected handedIn(work: ReviewQueueItem): string {
    if (work.submittedAt === null) {
      return '';
    }
    const at = new Date(work.submittedAt);
    const midnight = (moment: Date): number =>
      new Date(moment.getFullYear(), moment.getMonth(), moment.getDate()).getTime();
    const days = Math.round((midnight(new Date(this.now())) - midnight(at)) / DAY);
    const time = this.dates.transform(at, 'HH:mm') ?? '';
    return days === 0
      ? this.t.handedToday(time)
      : days === 1
        ? this.t.handedYesterday(time)
        : this.t.handedOn(this.dates.transform(at, 'dd.MM HH:mm') ?? '');
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

  /** Handed in (waiting for review or accepted). */
  protected handedCount(assignment: AssignmentSummary): number {
    return assignment.submitted + assignment.accepted;
  }

  /** The width of the progress bar a number of tasks takes, in percent. */
  protected share(count: number, assignment: AssignmentSummary): number {
    return assignment.totalTasks === 0 ? 0 : (count / assignment.totalTasks) * 100;
  }

  /** The materials of the assignment the row shows (the ones it has). */
  protected materials(assignment: AssignmentSummary): Material[] {
    const labels = this.t.materials;
    const all: Material[] = [
      { icon: 'tb-i tb-i-menu_book', label: labels.textbooks, count: assignment.textbooks },
      { icon: 'tb-i tb-i-attach_file', label: labels.files, count: assignment.files },
      { icon: 'tb-i tb-i-quiz', label: labels.questions, count: assignment.questions },
      { icon: 'tb-i tb-i-videocam', label: labels.videos, count: assignment.videos },
    ];
    return [
      ...all.filter((material) => material.count !== 0),
      ...(assignment.boardId === null
        ? []
        : [{ icon: 'tb-i tb-i-co_present', label: labels.board, count: null }]),
    ];
  }

  protected materialLabel(material: Material): string {
    return material.count === null
      ? material.label
      : this.t.materials.count(material.label, material.count);
  }

  /** «Анна и ещё 3». */
  protected whomOf(assignment: AssignmentSummary): string {
    const names = assignment.students;
    return names.length === 0
      ? this.t.nobody
      : names.length > SHOWN_STUDENTS
        ? this.t.andMore(names[0] ?? '', names.length - 1)
        : names.join(', ');
  }

  /** «12.10 18:00»; the year only when it is not the current one. */
  protected due(assignment: AssignmentSummary): string {
    return this.dueOf(assignment.dueAt, false);
  }

  /** «Анна и ещё 3 · до 12.10 18:00»: a card of a phone. */
  protected details(assignment: AssignmentSummary): string {
    return `${this.whomOf(assignment)} · ${this.dueOf(assignment.dueAt, true)}`;
  }

  private dueOf(dueAt: string | null, prefixed: boolean): string {
    if (dueAt === null) {
      return T.noDueDate;
    }
    const year = (moment: string | number): string | null => this.dates.transform(moment, 'yyyy');
    const format = year(dueAt) === year(this.now()) ? 'dd.MM HH:mm' : 'dd.MM.yyyy HH:mm';
    const text = this.dates.transform(dueAt, format) ?? '';
    return prefixed ? this.t.until(text) : text;
  }
}
