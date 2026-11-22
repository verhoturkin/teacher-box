import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import { ListRow } from '@shared/ui/list-row';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { HomeworkApi } from '../data-access/homework-api';
import { PeriodTask, TasksReport } from '../data-access/homework.models';
import { TASK_STATUS_LABELS, TASK_STATUS_SEVERITIES } from '../homework-labels';
import { T } from '../i18n/texts';

/** An answer handed in after the deadline. */
function handedInLate(task: PeriodTask): boolean {
  return (
    task.submittedAt !== null &&
    task.dueAt !== null &&
    Date.parse(task.submittedAt) > Date.parse(task.dueAt)
  );
}

/**
 * The homework of a student's period (the page «Итоги за период», roadmap 11 «AI»): set, handed in (on time and
 * late), accepted and returned, and every task given on the days `[from, to]` with its status and grade, each a
 * link to the task. Read again when the student or the period changes.
 */
@Component({
  selector: 'tb-period-tasks-card',
  imports: [Card, DatePipe, EmptyState, ListRow, LoadStateView, RouterLink, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <tb-load-state [state]="state" [what]="t.what" [skeleton]="true" (retry)="load()">
        @if (report(); as report) {
          <dl class="tb-figures">
            <div class="tb-figure">
              <dt class="tb-figure__label">{{ t.assigned }}</dt>
              <dd class="tb-figure__value">{{ report.assigned }}</dd>
            </div>
            <div class="tb-figure">
              <dt class="tb-figure__label">{{ t.submitted }}</dt>
              <dd class="tb-figure__value">{{ report.submitted }}</dd>
              @if (report.submitted > 0) {
                <dd class="tb-period-tasks__note">
                  {{ t.handedIn(report.onTime, report.late) }}
                </dd>
              }
            </div>
            <div class="tb-figure">
              <dt class="tb-figure__label">{{ t.accepted }}</dt>
              <dd class="tb-figure__value">{{ report.accepted }}</dd>
            </div>
            <div class="tb-figure">
              <dt class="tb-figure__label">{{ t.returned }}</dt>
              <dd class="tb-figure__value">{{ report.returned }}</dd>
            </div>
          </dl>
          @if (report.tasks.length === 0) {
            <tb-empty-state [compact]="true" icon="tb-i-assignment" [title]="t.nothing" />
          } @else {
            <ul class="tb-list tb-list--no-phone-lead tb-period-tasks" [attr.aria-label]="t.title">
              @for (task of report.tasks; track task.taskId) {
                <li tbListRow>
                  <span class="tb-list__lead" aria-hidden="true"
                    ><i class="tb-i tb-i-assignment"></i
                  ></span>
                  <div class="tb-list__text">
                    <a
                      class="tb-list__title tb-link"
                      [routerLink]="['/teacher/homework/tasks', task.taskId]"
                      >{{ task.title }}</a
                    >
                    <span class="tb-list__supporting">
                      {{ t.given((task.assignedAt | date: 'dd.MM') ?? '') }} ·
                      @if (task.dueAt !== null) {
                        {{ t.until((task.dueAt | date: 'dd.MM') ?? '') }}
                      } @else {
                        {{ noDueDate }}
                      }
                      @if (late(task)) {
                        · {{ t.late }}
                      }
                      @if (task.grade !== null) {
                        · {{ grade(task.grade) }}
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
          }
        }
      </tb-load-state>
    </p-card>
  `,
  styles: `
    .tb-period-tasks {
      margin-block-start: var(--tb-space-4);
    }

    .tb-period-tasks__note {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
      letter-spacing: var(--tb-tracking-body-s);
    }
  `,
})
export class PeriodTasksCard {
  protected readonly t = T.periodTasks;
  protected readonly noDueDate = T.noDueDate;
  protected readonly grade = T.grade;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly statusSeverities = TASK_STATUS_SEVERITIES;
  protected readonly late = handedInLate;
  private readonly api = inject(HomeworkApi);

  readonly studentId = input.required<string>();
  /** ISO dates: the first and the last day of the period. */
  readonly from = input.required<string>();
  readonly to = input.required<string>();

  protected readonly state = new LoadState();
  protected readonly report = signal<TasksReport | null>(null);

  constructor() {
    effect(() => {
      this.studentId();
      this.from();
      this.to();
      untracked(() => {
        this.load();
      });
    });
  }

  protected load(): void {
    this.api
      .studentReport(this.studentId(), this.from(), this.to())
      .pipe(this.state.track())
      .subscribe((report) => {
        this.report.set(report);
      });
  }
}
