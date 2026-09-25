import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { MyTask } from '../data-access/homework.models';
import { TaskStatusTag } from '../ui/task-status-tag';

/** Student: own tasks; the ones that need work come first. */
@Component({
  selector: 'tb-my-homework-page',
  imports: [DatePipe, RouterLink, Card, TableModule, RowType, TaskStatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Домашние задания</h1>
    <p-card>
      <p-table [value]="tasks()" dataKey="taskId" [rowHover]="true" [loading]="loading()">
        <ng-template #header>
          <tr>
            <th>Задание</th>
            <th>Срок</th>
            <th>Статус</th>
          </tr>
        </ng-template>
        <ng-template #body let-task [tbRowType]="tasks()">
          <tr>
            <td><a [routerLink]="[task.taskId]" class="tb-link">{{ task.title }}</a></td>
            <td [class.tb-negative]="task.overdue">
              {{ task.dueAt ? (task.dueAt | date: 'dd.MM.yyyy HH:mm') : 'без срока' }}
            </td>
            <td><tb-task-status [status]="task.status" [overdue]="task.overdue" [grade]="task.grade" /></td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="3" class="tb-empty">Заданий пока нет</td></tr>
        </ng-template>
      </p-table>
    </p-card>
  `,
})
export class MyHomeworkPage implements OnInit {
  private readonly api = inject(HomeworkApi);

  private readonly all = signal<MyTask[]>([]);
  protected readonly loading = signal(true);
  /** Open tasks (assigned or returned) first, then the rest; newest first inside each group. */
  protected readonly tasks = computed(() => {
    const open = (task: MyTask): number => (task.status === 'ASSIGNED' || task.status === 'RETURNED' ? 0 : 1);
    return [...this.all()].sort((a, b) => open(a) - open(b) || b.assignedAt.localeCompare(a.assignedAt));
  });

  ngOnInit(): void {
    this.api.myTasks().subscribe({
      next: (tasks) => {
        this.all.set(tasks);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
