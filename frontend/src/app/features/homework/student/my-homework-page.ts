import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { HelpButton } from '@features/help/parts';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { MyTask } from '../data-access/homework.models';
import { TaskStatusTag } from '../ui/task-status-tag';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { T } from '../i18n/texts';

/** Student: own tasks; the ones that need work come first. */
@Component({
  selector: 'tb-my-homework-page',
  imports: [
    EmptyState,
    HelpButton,
    DatePipe,
    RouterLink,
    Card,
    TableModule,
    RowType,
    TaskStatusTag,
    LoadStateView,
    PageHeader,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="cabinet/homework" />
    </tb-page-header>
    <p-card>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        <p-table [value]="tasks()" dataKey="taskId" [rowHover]="true" styleClass="tb-cards">
          <ng-template #header>
            <tr>
              <th class="tb-col-main">{{ t.assignment }}</th>
              <th>{{ t.due }}</th>
              <th>{{ t.status }}</th>
            </tr>
          </ng-template>
          <ng-template #body let-task [tbRowType]="tasks()">
            <tr>
              <td [attr.data-label]="t.assignment">
                <a [routerLink]="[task.taskId]" class="tb-link">{{ task.title }}</a>
              </td>
              <td [attr.data-label]="t.due" [class.tb-negative]="task.overdue">
                {{ task.dueAt ? (task.dueAt | date: 'dd.MM.yyyy HH:mm') : noDueDate }}
              </td>
              <td [attr.data-label]="t.status">
                <tb-task-status
                  [status]="task.status"
                  [overdue]="task.overdue"
                  [grade]="task.grade"
                />
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="3">
                <tb-empty-state
                  icon="pi-pen-to-square"
                  [title]="t.emptyTitle"
                  [hint]="t.emptyHint"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </tb-load-state>
    </p-card>
  `,
})
export class MyHomeworkPage implements OnInit {
  protected readonly noDueDate = T.noDueDate;
  protected readonly t = T.mine;
  private readonly api = inject(HomeworkApi);

  private readonly all = signal<MyTask[]>([]);
  protected readonly state = new LoadState();
  /** Open tasks (assigned or returned) first, then the rest; newest first inside each group. */
  protected readonly tasks = computed(() => {
    const open = (task: MyTask): number =>
      task.status === 'ASSIGNED' || task.status === 'RETURNED' ? 0 : 1;
    return [...this.all()].sort(
      (a, b) => open(a) - open(b) || b.assignedAt.localeCompare(a.assignedAt),
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
        this.all.set(tasks);
      });
  }
}
