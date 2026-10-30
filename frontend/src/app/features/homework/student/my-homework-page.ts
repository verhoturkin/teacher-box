import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HelpButton } from '@features/help/parts';
import { ButtonDirective } from 'primeng/button';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { Pane, Panes, injectListDetail } from '@shared/ui/panes';
import { HomeworkApi } from '../data-access/homework-api';
import { MyTask } from '../data-access/homework.models';
import { Material, materialLabel, materialsOf } from '../ui/materials';
import { TaskStatusTag } from '../ui/task-status-tag';
import { T } from '../i18n/texts';
import { MyTaskPage } from './my-task-page';

type GroupKey = 'returned' | 'todo' | 'done';

interface Group {
  readonly key: GroupKey;
  readonly label: string;
  readonly icon: string;
  readonly tasks: readonly MyTask[];
}

const DAY = 86_400_000;

/** Whole calendar days from today to the deadline (negative — past it). */
function daysUntil(dueAt: string): number {
  const startOfDay = (time: number): number => new Date(time).setHours(0, 0, 0, 0);
  return Math.round((startOfDay(Date.parse(dueAt)) - startOfDay(Date.now())) / DAY);
}

/**
 * Student: homework as a list-detail (redesign spec §9). The list pane groups the tasks by what the
 * student does next — «Вернули на доработку» (with the teacher's comment), «Сделать» (by the deadline),
 * «Сдано» (on review or accepted); an empty group is not shown. On one pane a card «Ближайшее» leads the
 * list. The detail pane is the task with the answer form (`/cabinet/homework/:taskId`); «back» leads to
 * the list.
 */
@Component({
  selector: 'tb-my-homework-page',
  imports: [
    ButtonDirective,
    EmptyState,
    HelpButton,
    LoadStateView,
    MyTaskPage,
    PageHeader,
    Pane,
    Panes,
    RouterLink,
    TaskStatusTag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-panes>
      @if (layout.list()) {
        <tb-pane kind="fixed" [label]="t.title">
          <div tbPaneHeader>
            <tb-page-header [title]="t.title">
              <tb-help-button help topic="cabinet/homework" />
            </tb-page-header>
          </div>

          <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
            @if (tasks().length > 0) {
              @if (layout.single() && nearest(); as next) {
                <section class="tb-hw__nearest" [attr.aria-label]="t.nearest">
                  <span class="tb-hw__group">{{ t.nearest }}</span>
                  <strong class="tb-hw__nearest-title">{{ next.title }}</strong>
                  <span [class.tb-negative]="next.overdue">{{ supporting(next) }}</span>
                  <span class="tb-hw__materials">
                    @for (material of materials(next); track material.icon) {
                      <span
                        class="tb-hw__material"
                        role="img"
                        [attr.aria-label]="materialLabel(material)"
                      >
                        <i [class]="material.icon" aria-hidden="true"></i>
                        @if (material.count !== null) {
                          {{ material.count }}
                        }
                      </span>
                    }
                  </span>

                  <a
                    pButton
                    severity="secondary"
                    [routerLink]="['/cabinet/homework', next.taskId]"
                    >{{ t.open }}</a
                  >
                </section>
              }
              @for (group of groups(); track group.key) {
                <h2 class="tb-hw__group" [class.tb-negative]="group.key === 'returned'">
                  {{ group.label }}
                </h2>
                <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="group.label">
                  @for (task of group.tasks; track task.taskId) {
                    <li [class.tb-list__item--current]="taskId() === task.taskId">
                      <span class="tb-list__lead" aria-hidden="true"
                        ><i class="tb-i" [class]="group.icon"></i
                      ></span>
                      <div class="tb-list__text">
                        <a
                          class="tb-list__title tb-list__link"
                          [routerLink]="['/cabinet/homework', task.taskId]"
                          [attr.aria-current]="taskId() === task.taskId ? 'page' : null"
                          >{{ task.title }}</a
                        >
                        <span
                          class="tb-list__supporting"
                          [class.tb-negative]="task.overdue || group.key === 'returned'"
                          >{{ supporting(task) }}</span
                        >
                        <span class="tb-hw__materials">
                          @for (material of materials(task); track material.icon) {
                            <span
                              class="tb-hw__material"
                              role="img"
                              [attr.aria-label]="materialLabel(material)"
                            >
                              <i [class]="material.icon" aria-hidden="true"></i>
                              @if (material.count !== null) {
                                {{ material.count }}
                              }
                            </span>
                          }
                        </span>
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
              }
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
    .tb-hw__group {
      margin: var(--tb-space-4) 0 var(--tb-space-2);
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--p-md-on-surface-variant);
    }
    .tb-hw__group.tb-negative {
      color: var(--p-md-error);
    }
    /* the nearest task on one pane: a tonal card (our decision, as the figures block) */
    .tb-hw__nearest {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--tb-space-2);
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }
    .tb-hw__nearest .tb-hw__group {
      margin: 0;
      color: inherit;
    }
    .tb-hw__materials {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-3);
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
    .tb-hw__nearest-title {
      font-size: 1rem;
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

  /** Returned (the oldest first), to do (by the deadline, none last), handed in (the newest first). */
  protected readonly groups = computed<Group[]>(() => {
    const of = (...statuses: MyTask['status'][]): MyTask[] =>
      this.tasks().filter((task) => statuses.includes(task.status));
    const byDue = (a: MyTask, b: MyTask): number =>
      (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999');
    const groups: Group[] = [
      {
        key: 'returned',
        label: this.t.groupReturned,
        icon: 'tb-i-replay',
        tasks: of('RETURNED').sort((a, b) =>
          (a.reviewedAt ?? '').localeCompare(b.reviewedAt ?? ''),
        ),
      },
      {
        key: 'todo',
        label: this.t.groupTodo,
        icon: 'tb-i-assignment',
        tasks: of('ASSIGNED').sort(byDue),
      },
      {
        key: 'done',
        label: this.t.groupDone,
        icon: 'tb-i-check_circle',
        tasks: of('SUBMITTED', 'ACCEPTED').sort((a, b) => b.assignedAt.localeCompare(a.assignedAt)),
      },
    ];
    return groups.filter((group) => group.tasks.length > 0);
  });

  protected readonly materialLabel = materialLabel;

  protected materials(task: MyTask): Material[] {
    return materialsOf(task, task.board);
  }

  /** The task to open first: the oldest returned one, else the nearest deadline. */
  protected readonly nearest = computed(() => {
    const groups = this.groups();
    return (
      groups.find((group) => group.key === 'returned')?.tasks[0] ??
      groups.find((group) => group.key === 'todo')?.tasks[0]
    );
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

  /** The second line: the teacher's comment, «остался 2 дня» / «сегодня» / «просрочено на 1 день», «сдано …». */
  protected supporting(task: MyTask): string {
    if (task.status === 'RETURNED' && task.teacherComment !== null) {
      return task.teacherComment;
    }
    if (task.status === 'SUBMITTED' || task.status === 'ACCEPTED') {
      return this.t.submitted(
        this.dates.transform(task.reviewedAt ?? task.assignedAt, 'dd.MM.yyyy') ?? '',
      );
    }
    if (task.dueAt === null) {
      return T.noDueDate;
    }
    const days = daysUntil(task.dueAt);
    return days < 0 ? this.t.overdueBy(-days) : days === 0 ? this.t.today : this.t.daysLeft(days);
  }
}
