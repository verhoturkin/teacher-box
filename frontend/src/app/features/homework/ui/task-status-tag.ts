import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { Tag } from 'primeng/tag';
import { TaskStatus } from '../data-access/homework.models';
import { TASK_STATUS_LABELS, TASK_STATUS_SEVERITIES } from '../homework-labels';
import { T } from '../i18n/texts';

/**
 * Status of a task and its grade. No «Просрочено» tag: the supporting line of the row says it («просрочено на
 * 3 дня»). The tag and the grade stack in a column (a narrow list trail on a phone); `inline` puts them in a row.
 */
@Component({
  selector: 'tb-task-status',
  imports: [Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tb-task-tags" [class.tb-task-tags--inline]="inline()">
      <p-tag [value]="labels[status()]" [severity]="severities[status()]" />
      @if (grade(); as grade) {
        <span class="tb-strong">{{ t.grade(grade) }}</span>
      }
    </span>
  `,
  styles: `
    .tb-task-tags {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--tb-space-1);
    }
    .tb-task-tags--inline {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
  `,
})
export class TaskStatusTag {
  protected readonly t = T;
  readonly status = input.required<TaskStatus>();
  readonly inline = input(false, { transform: booleanAttribute });
  readonly grade = input<string | null>(null);

  protected readonly labels = TASK_STATUS_LABELS;
  protected readonly severities = TASK_STATUS_SEVERITIES;
}
