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
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { HomeworkApi } from '../data-access/homework-api';
import { MyTask } from '../data-access/homework.models';
import { TASK_STATUS_LABELS, TASK_STATUS_SEVERITIES } from '../homework-labels';
import { T } from '../i18n/texts';
import { byUrgency } from './student-tasks-card';

/** Rows shown at first and added by «Показать ещё». */
export const TASKS_PAGE = 20;

/** Open tasks as on Обзор, then the accepted ones, the latest reviewed first. */
function inOrder(a: MyTask, b: MyTask): number {
  const accepted = Number(a.status === 'ACCEPTED') - Number(b.status === 'ACCEPTED');
  if (accepted !== 0) {
    return accepted;
  }
  return a.status === 'ACCEPTED'
    ? (b.reviewedAt ?? b.assignedAt).localeCompare(a.reviewedAt ?? a.assignedAt)
    : byUrgency(a, b);
}

/**
 * The Задания tab of a student's card (redesign spec §8): every task of the student with its status — the
 * open ones first, as on Обзор, then the accepted ones with the grade — each a link to the task.
 */
@Component({
  selector: 'tb-student-tasks-tab',
  imports: [Button, Card, DatePipe, EmptyState, LoadStateView, RouterLink, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (tasks().length === 0) {
          <tb-empty-state [compact]="true" icon="tb-i-assignment" [title]="t.nothing" />
        } @else {
          <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
            @for (task of visible(); track task.taskId) {
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
                    @if (task.status === 'ACCEPTED') {
                      @if (task.reviewedAt !== null) {
                        {{ t.reviewed((task.reviewedAt | date: 'dd.MM.yyyy') ?? '') }}
                      }
                      @if (task.grade !== null) {
                        · {{ grade(task.grade) }}
                      }
                    } @else {
                      @if (task.dueAt !== null) {
                        {{ t.until((task.dueAt | date: 'dd.MM.yyyy') ?? '') }}
                      } @else {
                        {{ noDueDate }}
                      }
                      @if (task.overdue) {
                        · {{ overdue }}
                      }
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
          @if (visible().length < tasks().length) {
            <p-button [label]="t.showMore" [text]="true" (onClick)="showMore()" />
          }
        }
      </tb-load-state>
    </p-card>
  `,
})
export class StudentTasksTab {
  protected readonly t = T.tasksTab;
  protected readonly overdue = T.overdue;
  protected readonly noDueDate = T.noDueDate;
  protected readonly grade = T.grade;
  protected readonly statusLabels = TASK_STATUS_LABELS;
  protected readonly statusSeverities = TASK_STATUS_SEVERITIES;
  private readonly api = inject(HomeworkApi);

  readonly studentId = input.required<string>();

  protected readonly state = new LoadState();
  protected readonly tasks = signal<readonly MyTask[]>([]);
  private readonly shown = signal(TASKS_PAGE);
  protected readonly visible = computed(() => this.tasks().slice(0, this.shown()));

  constructor() {
    effect(() => {
      this.studentId();
      untracked(() => {
        this.load();
      });
    });
  }

  protected load(): void {
    this.shown.set(TASKS_PAGE);
    this.api
      .studentTasks(this.studentId())
      .pipe(this.state.track())
      .subscribe((tasks) => {
        this.tasks.set([...tasks].sort(inOrder));
      });
  }

  protected showMore(): void {
    this.shown.update((shown) => shown + TASKS_PAGE);
  }
}
