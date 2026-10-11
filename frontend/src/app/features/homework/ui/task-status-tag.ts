import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { TaskStatus } from '../data-access/homework.models';
import { TASK_STATUS_LABELS, TASK_STATUS_SEVERITIES } from '../homework-labels';
import { T } from '../i18n/texts';

/** Status of a task, with an "overdue" mark for open tasks past the deadline. */
@Component({
  selector: 'tb-task-status',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tb-inline">
      <p-tag [value]="labels[status()]" [severity]="severities[status()]" />
      @if (overdue()) {
        <p-tag [value]="t.overdue" severity="danger" />
      }
      @if (grade(); as grade) {
        <span class="tb-strong">{{ t.grade(grade) }}</span>
      }
    </span>
  `,
})
export class TaskStatusTag {
  protected readonly t = T;
  readonly status = input.required<TaskStatus>();
  readonly overdue = input(false);
  readonly grade = input<string | null>(null);

  protected readonly labels = TASK_STATUS_LABELS;
  protected readonly severities = TASK_STATUS_SEVERITIES;
}
