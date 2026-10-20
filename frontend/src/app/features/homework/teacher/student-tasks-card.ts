import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { HomeworkApi } from '../data-access/homework-api';
import { MyTask } from '../data-access/homework.models';
import { TASK_STATUS_LABELS, TASK_STATUS_SEVERITIES } from '../homework-labels';
import { T } from '../i18n/texts';

/** How many open tasks the card shows. */
const SHOWN = 5;

/** Works waiting for the teacher first, then by the deadline (none last). */
function byUrgency(a: MyTask, b: MyTask): number {
  const review = Number(b.status === 'SUBMITTED') - Number(a.status === 'SUBMITTED');
  if (review !== 0) {
    return review;
  }
  return (a.dueAt ?? '￿').localeCompare(b.dueAt ?? '￿');
}

/**
 * Overview of a student's card (redesign spec §8): the student's open tasks — given, on review, returned
 * for rework — each a link to the task.
 */
@Component({
  selector: 'tb-student-tasks-card',
  imports: [Card, DatePipe, EmptyState, LoadStateView, RouterLink, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (shown().length === 0) {
          <tb-empty-state [compact]="true" icon="tb-i-assignment" [title]="t.nothing" />
        } @else {
          <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
            @for (task of shown(); track task.taskId) {
              <li>
                <span
                  class="tb-list__lead"
                  [class.tb-list__lead--accent]="task.overdue"
                  aria-hidden="true"
                  ><i class="tb-i tb-i-assignment"></i
                ></span>
                <div class="tb-list__text">
                  <a
                    class="tb-list__title tb-link"
                    [routerLink]="['/teacher/homework/tasks', task.taskId]"
                    >{{ task.title }}</a
                  >
                  <span class="tb-list__supporting">
                    @if (task.dueAt !== null) {
                      {{ t.until((task.dueAt | date: 'dd.MM.yyyy') ?? '') }}
                    } @else {
                      {{ noDueDate }}
                    }
                    @if (task.overdue) {
                      · {{ overdue }}
                    }
                  </span>
                </div>
                <div class="tb-list__trail">
                  <p-tag
                    [value]="statusLabels[task.status]"
                    [severity]="statusSeverities[task.status]"
                  />
                </div>
              </li>
            }
          </ul>
          @if (more() > 0) {
            <p class="tb-muted tb-student-tasks__more">{{ t.more(more()) }}</p>
          }
        }
      </tb-load-state>
    </p-card>
  `,
  styles: `
    .tb-student-tasks__more {
      margin: var(--tb-space-2) 0 0;
    }
  `,
})
export class StudentTasksCard {
  protected readonly t = T.studentTasks;
  protected readonly overdue = T.overdue;
  protected readonly noDueDate = T.noDueDate;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly statusSeverities = TASK_STATUS_SEVERITIES;
  private readonly api = inject(HomeworkApi);

  readonly studentId = input.required<string>();

  protected readonly state = new LoadState();
  private readonly tasks = signal<readonly MyTask[]>([]);
  private readonly open = computed(() =>
    this.tasks()
      .filter((task) => task.status !== 'ACCEPTED')
      .sort(byUrgency),
  );
  protected readonly shown = computed(() => this.open().slice(0, SHOWN));
  protected readonly more = computed(() => this.open().length - this.shown().length);

  constructor() {
    effect(() => {
      this.studentId();
      untracked(() => {
        this.load();
      });
    });
  }

  protected load(): void {
    this.api
      .studentTasks(this.studentId())
      .pipe(this.state.track())
      .subscribe((tasks) => {
        this.tasks.set(tasks);
      });
  }
}
