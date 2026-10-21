import { DatePipe } from '@angular/common';
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
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';
import { SearchField } from '@shared/ui/search-field';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';
import { HomeworkApi } from '../data-access/homework-api';
import { MyTask, TaskStatus } from '../data-access/homework.models';
import { TaskStatusTag } from '../ui/task-status-tag';
import { T } from '../i18n/texts';
import { MyTaskPage } from './my-task-page';

/** What the list shows: to do (assigned or returned), handed in, accepted. */
type Filter = 'todo' | 'review' | 'ready';

const FILTER_OF: Record<TaskStatus, Filter> = {
  ASSIGNED: 'todo',
  RETURNED: 'todo',
  SUBMITTED: 'review',
  ACCEPTED: 'ready',
};

/**
 * Student: homework as a list-detail (redesign spec §9), like the teacher's: the list pane has the connected
 * group «Сдать · На проверке · Готовые» with the counts, one search under the filter button of the header and
 * tonal rows on the pane's surface; the detail pane is the task with the answer form
 * (`/cabinet/homework/:taskId`). On one pane the route decides what is shown, «back» leads to the list.
 */
@Component({
  selector: 'tb-my-homework-page',
  imports: [
    Button,
    ButtonAttributes,
    EmptyState,
    HelpButton,
    LoadStateView,
    MyTaskPage,
    PageHeader,
    Pane,
    Panes,
    ReactiveFormsModule,
    RouterLink,
    SearchField,
    SegmentGroup,
    TaskStatusTag,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      @if (layout.list()) {
        <tb-pane kind="fixed" [label]="t.title" [class.tb-hw__pane]="!layout.single()">
          <tb-page-header [title]="t.title">
            <tb-help-button help topic="cabinet/homework" />
            @if (tasks().length > 0) {
              <p-button
                icon="tb-i tb-i-filter_list"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [pTooltip]="searchOpen() ? t.hideSearch : t.showSearch"
                [ariaLabel]="searchOpen() ? t.hideSearch : t.showSearch"
                [tbAttributes]="{ 'aria-pressed': searchOpen() ? 'true' : 'false' }"
                (onClick)="toggleSearch()"
              />
            }
          </tb-page-header>

          <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
            @if (tasks().length > 0) {
              <div class="tb-hw__filters">
                <tb-segment-group [label]="t.filters" [segments]="segments()" [(value)]="filter" />
                @if (searchOpen()) {
                  <tb-search-field [formControl]="search" [label]="t.search" />
                }
              </div>

              <!-- beside the detail only the list scrolls: the header, the group and the search stay -->
              <div class="tb-hw__scroll">
                @if (rows().length > 0) {
                  <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="filterLabel()">
                    @for (task of rows(); track task.taskId) {
                      <li [class.tb-list__item--current]="taskId() === task.taskId">
                        <span class="tb-list__lead" aria-hidden="true"
                          ><i class="tb-i tb-i-assignment"></i
                        ></span>
                        <div class="tb-list__text">
                          <a
                            class="tb-list__title tb-list__link"
                            [routerLink]="['/cabinet/homework', task.taskId]"
                            [attr.aria-current]="taskId() === task.taskId ? 'page' : null"
                            >{{ task.title }}</a
                          >
                          <span class="tb-list__supporting" [class.tb-negative]="task.overdue">{{
                            due(task)
                          }}</span>
                        </div>
                        <div class="tb-list__trail tb-list__trail--icons">
                          <tb-task-status
                            [status]="task.status"
                            [overdue]="task.overdue"
                            [grade]="task.grade"
                          />
                        </div>
                      </li>
                    }
                  </ul>
                } @else if (searching()) {
                  <tb-empty-state
                    icon="tb-i-search"
                    [title]="t.notFoundTitle"
                    [hint]="t.notFoundHint"
                  />
                } @else {
                  @switch (filter()) {
                    @case ('todo') {
                      <tb-empty-state
                        icon="tb-i-assignment"
                        [title]="t.noTodoTitle"
                        [hint]="t.noTodoHint"
                      />
                    }
                    @case ('review') {
                      <tb-empty-state
                        icon="tb-i-assignment"
                        [title]="t.noReviewTitle"
                        [hint]="t.noReviewHint"
                      />
                    }
                    @case ('ready') {
                      <tb-empty-state
                        icon="tb-i-check_circle"
                        [title]="t.noReadyTitle"
                        [hint]="t.noReadyHint"
                      />
                    }
                  }
                }
              </div>
            } @else {
              <tb-empty-state icon="tb-i-assignment" [title]="t.emptyTitle" [hint]="t.emptyHint" />
            }
          </tb-load-state>
        </tb-pane>
      }
      @if (layout.detail()) {
        <tb-pane [label]="t.pickTitle">
          @if (taskId(); as id) {
            <tb-my-task-page [taskId]="id" [single]="layout.single()" (changed)="refresh()" />
          } @else {
            <tb-empty-state icon="tb-i-assignment" [title]="t.pickTitle" [hint]="t.pickHint" />
          }
        </tb-pane>
      }
    </tb-panes>
  `,
  styles: `
    /* from expanded the pane does not scroll as a whole: its list does (our decision, as the teacher's list) */
    .tb-hw__pane ::ng-deep .tb-pane__scroll {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .tb-hw__pane .tb-hw__scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .tb-hw__filters {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-4);
    }
  `,
})
export class MyHomeworkPage implements OnInit {
  protected readonly t = T.mine;
  private readonly api = inject(HomeworkApi);
  private readonly dates = new DatePipe(inject(LOCALE_ID));

  /** Route parameter: the task open beside the list. */
  readonly taskId = input<string>();
  protected readonly layout = injectListDetail(() => this.taskId() !== undefined);

  protected readonly tasks = signal<MyTask[]>([]);
  protected readonly state = new LoadState();
  protected readonly searchOpen = signal(false);
  protected readonly search = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  protected readonly searching = computed(() => this.query().trim() !== '');

  /** The chosen filter; until one is chosen «Сдать» while there is something to do, else «На проверке», else «Готовые». */
  protected readonly filter = linkedSignal<Filter>(() => {
    const tasks = this.tasks();
    return tasks.some((task) => FILTER_OF[task.status] === 'todo')
      ? 'todo'
      : tasks.some((task) => FILTER_OF[task.status] === 'review')
        ? 'review'
        : tasks.length > 0
          ? 'ready'
          : 'todo';
  });

  protected readonly segments = computed<Segment<Filter>[]>(() => {
    const count = (filter: Filter): number =>
      this.tasks().filter((task) => FILTER_OF[task.status] === filter).length;
    return [
      { value: 'todo', label: this.t.todo, count: count('todo') },
      { value: 'review', label: this.t.review, count: count('review') },
      { value: 'ready', label: this.t.ready, count: count('ready') },
    ];
  });

  protected readonly filterLabel = computed(
    () => this.segments().find((segment) => segment.value === this.filter())?.label ?? '',
  );

  /** The tasks of the filter whose title has the search text; newest first. */
  protected readonly rows = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.tasks()
      .filter(
        (task) =>
          FILTER_OF[task.status] === this.filter() &&
          (query === '' || task.title.toLocaleLowerCase().includes(query)),
      )
      .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .myTasks()
      .pipe(this.state.track())
      .subscribe((tasks) => {
        this.tasks.set(tasks);
      });
  }

  /** An answer was handed in: reads the list again without the loading state. */
  protected refresh(): void {
    this.api.myTasks().subscribe((tasks) => {
      this.tasks.set(tasks);
    });
  }

  protected toggleSearch(): void {
    if (this.searchOpen()) {
      this.search.setValue('');
    }
    this.searchOpen.update((open) => !open);
  }

  /** «до 12.10.2026 18:00» or «без срока». */
  protected due(task: MyTask): string {
    return task.dueAt === null
      ? T.noDueDate
      : T.list.until(this.dates.transform(task.dueAt, 'dd.MM.yyyy HH:mm') ?? '');
  }
}
