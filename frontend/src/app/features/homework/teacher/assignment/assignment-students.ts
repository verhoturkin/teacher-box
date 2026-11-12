import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { TeacherColors } from '@features/identity/parts';
import { Avatar } from '@shared/ui/avatar';
import { Busy } from '@shared/ui/busy';
import { EmptyState } from '@shared/ui/empty-state';
import { TaskStatus, TaskSummary } from '@features/homework/data-access/homework.models';
import { T } from '@features/homework/i18n/texts';
import { TaskStatusTag } from '@features/homework/ui/task-status-tag';
import { TaskLines } from './task-lines';

interface StudentGroup {
  readonly key: string;
  readonly status: TaskStatus;
  readonly icon: string;
  readonly label: string;
  readonly tasks: readonly TaskSummary[];
}

const GROUPS: readonly Omit<StudentGroup, 'tasks'>[] = [
  { key: 'review', status: 'SUBMITTED', icon: 'tb-i-rate_review', label: T.page.groupToReview },
  { key: 'returned', status: 'RETURNED', icon: 'tb-i-replay', label: T.page.groupReturned },
  { key: 'waiting', status: 'ASSIGNED', icon: 'tb-i-schedule', label: T.page.groupWaiting },
  { key: 'accepted', status: 'ACCEPTED', icon: 'tb-i-check_circle', label: T.page.groupAccepted },
];

/**
 * The students of an assignment in the narrow column of a wide window (sketch 4), grouped by status: what
 * to review first, then the sent back, the waiting, the accepted; one action a row.
 */
@Component({
  selector: 'tb-assignment-groups',
  imports: [Avatar, Button, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @for (group of groups(); track group.key) {
      <section class="tb-asg-group" [attr.aria-labelledby]="'tb-asg-group-' + group.key">
        <h3
          class="tb-asg-group__head tb-asg-group__head--{{ group.key }}"
          [id]="'tb-asg-group-' + group.key"
        >
          <i class="tb-i {{ group.icon }}" aria-hidden="true"></i>
          {{ group.label }}
          <span class="tb-asg-group__count">· {{ group.tasks.length }}</span>
        </h3>
        <ul class="tb-list tb-list--clamp tb-list--own-trail">
          @for (task of group.tasks; track task.taskId) {
            <li>
              <tb-avatar
                class="tb-list__lead"
                [attr.data-tb-label]="colors.studentLabel(task.studentId)"
                [name]="task.studentName"
                [photo]="task.studentAvatar"
              />
              <div class="tb-list__text">
                <button
                  type="button"
                  class="tb-list__title tb-link-button"
                  [attr.aria-label]="t.action(t.open, task.studentName)"
                  (click)="open.emit(task.taskId)"
                >
                  {{ task.studentName }}
                </button>
                <span
                  class="tb-list__supporting"
                  [class.tb-negative]="task.overdue && task.submittedAt === null"
                  >{{ lines.row(task, dueAt()) }}</span
                >
              </div>
              <!-- --icons: the one button stays on the right of the narrow column -->
              <div class="tb-list__trail tb-list__trail--icons">
                @if (task.status === 'SUBMITTED') {
                  <p-button
                    [label]="t.review"
                    [ariaLabel]="t.action(t.review, task.studentName)"
                    (onClick)="open.emit(task.taskId)"
                  />
                } @else if (task.status === 'ACCEPTED') {
                  <p-button
                    severity="secondary"
                    [label]="t.open"
                    [ariaLabel]="t.action(t.open, task.studentName)"
                    (onClick)="open.emit(task.taskId)"
                  />
                } @else {
                  <p-button
                    severity="secondary"
                    [label]="t.remind"
                    [ariaLabel]="t.action(t.remind, task.studentName)"
                    [loading]="busy().is(task.studentId)"
                    (onClick)="remind.emit(task)"
                  />
                }
              </div>
            </li>
          }
        </ul>
      </section>
    } @empty {
      <tb-empty-state icon="tb-i-send" [title]="t.notAssigned" />
    }
  `,
  styles: `
    .tb-asg-group {
      display: grid;
      gap: var(--tb-space-2);
    }

    /* a status group: the icon and the name in the status colour, the count muted (title small) */
    .tb-asg-group__head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      margin: 0;
      font: var(--tb-type-title-s);

      .tb-i {
        font-size: 1.125rem;
      }
    }

    .tb-asg-group__head--review {
      color: var(--p-md-warning);
    }

    .tb-asg-group__head--returned {
      color: var(--p-md-error);
    }

    .tb-asg-group__head--waiting {
      color: var(--p-md-on-surface-variant);
    }

    .tb-asg-group__head--accepted {
      color: var(--p-md-success);
    }

    .tb-asg-group__count {
      color: var(--p-md-on-surface-variant);
    }
  `,
})
export class AssignmentGroups {
  protected readonly t = T.page;
  protected readonly colors = inject(TeacherColors);
  protected readonly lines = new TaskLines(new DatePipe(inject(LOCALE_ID)));

  readonly tasks = input.required<readonly TaskSummary[]>();
  readonly dueAt = input.required<string | null>();
  /** «Напомнить» running for a student. */
  readonly busy = input.required<Busy>();
  /** «Проверить» or «Открыть»: the work of the task opens. */
  readonly open = output<string>();
  readonly remind = output<TaskSummary>();

  protected readonly groups = computed<StudentGroup[]>(() =>
    GROUPS.map((group) => ({
      ...group,
      tasks: this.tasks().filter((task) => task.status === group.status),
    })).filter((group) => group.tasks.length > 0),
  );
}

/**
 * The students of an assignment as tiles (sketch 18): the status line, the answer preview, the score and
 * the files, «Напомнить» to the ones who owe the work.
 */
@Component({
  selector: 'tb-assignment-tiles',
  imports: [Avatar, Button, ButtonDirective, ButtonLabel, EmptyState, TaskStatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (tasks().length > 0) {
      <ul class="tb-asg__tiles" [attr.aria-label]="t.students">
        @for (task of tasks(); track task.taskId) {
          <li class="tb-asg-tile">
            <div class="tb-asg-tile__head">
              <tb-avatar
                [attr.data-tb-label]="colors.studentLabel(task.studentId)"
                [name]="task.studentName"
                [photo]="task.studentAvatar"
              />
              <div class="tb-asg-tile__who">
                <span class="tb-asg-tile__name">{{ task.studentName }}</span>
                <span
                  class="tb-asg-tile__line"
                  [class.tb-negative]="task.overdue && task.submittedAt === null"
                  >{{ lines.status(task, dueAt()) }}</span
                >
              </div>
              <tb-task-status inline [status]="task.status" />
            </div>
            @if (task.answerPreview; as preview) {
              <p class="tb-asg-tile__preview">{{ preview }}</p>
            }
            <div class="tb-asg-tile__foot">
              @if (task.quizScore !== null && task.quizMax !== null) {
                <span class="tb-asg-tile__meta"
                  ><i class="tb-i tb-i-quiz" aria-hidden="true"></i
                  >{{ t.quiz(task.quizScore, task.quizMax) }}</span
                >
              }
              @if (task.answerFiles > 0) {
                <span class="tb-asg-tile__meta"
                  ><i class="tb-i tb-i-attach_file" aria-hidden="true"></i
                  >{{ t.files(task.answerFiles) }}</span
                >
              }
              <span class="tb-asg__spacer"></span>
              @if (task.status === 'ASSIGNED' || task.status === 'RETURNED') {
                <p-button
                  severity="secondary"
                  [label]="t.remind"
                  [ariaLabel]="t.action(t.remind, task.studentName)"
                  [loading]="busy().is(task.studentId)"
                  (onClick)="remind.emit(task)"
                />
              }
              <button
                pButton
                type="button"
                severity="secondary"
                (click)="open.emit(task.taskId)"
                [attr.aria-label]="
                  t.action(task.status === 'SUBMITTED' ? t.review : t.open, task.studentName)
                "
              >
                <span pButtonLabel>{{ task.status === 'SUBMITTED' ? t.review : t.open }}</span>
              </button>
            </div>
          </li>
        }
      </ul>
    } @else {
      <tb-empty-state icon="tb-i-send" [title]="t.notAssigned" />
    }
  `,
  styles: `
    .tb-asg__spacer {
      flex: 1 1 0;
    }

    .tb-asg__tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--tb-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* two tiles do not fit below 36rem of the students' column: one column */
    @container (width < 36rem) {
      .tb-asg__tiles {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    /* a student: a surface container tile (M3 filled card, 20 dp corners; our decision for the content) */
    .tb-asg-tile {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
      border-radius: 20px;
      background: var(--p-md-surface-container);
    }

    .tb-asg-tile__head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-asg-tile__who {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-width: 0;
    }

    .tb-asg-tile__name {
      font: var(--tb-type-title-s);
      overflow-wrap: anywhere;
    }

    .tb-asg-tile__line {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    /* the inset is a transparent border, not padding: the clamp cuts the text at the content edge, so no
       half of a fourth line shows in the padding */
    .tb-asg-tile__preview {
      display: -webkit-box;
      margin: 0;
      border: var(--tb-space-3) solid transparent;
      border-radius: 12px;
      background: var(--p-md-surface);
      font: var(--tb-type-body-m);
      overflow: hidden;
      overflow-wrap: anywhere;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    /* a tile stretched to the row's height keeps its buttons at the bottom */
    .tb-asg-tile__foot {
      display: flex;
      margin-block-start: auto;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-asg-tile__meta {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }
  `,
})
export class AssignmentTiles {
  protected readonly t = T.page;
  protected readonly colors = inject(TeacherColors);
  protected readonly lines = new TaskLines(new DatePipe(inject(LOCALE_ID)));

  readonly tasks = input.required<readonly TaskSummary[]>();
  readonly dueAt = input.required<string | null>();
  /** «Напомнить» running for a student. */
  readonly busy = input.required<Busy>();
  /** «Проверить» or «Открыть»: the work of the task opens. */
  readonly open = output<string>();
  readonly remind = output<TaskSummary>();
}
