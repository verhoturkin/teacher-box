import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { HomeworkApi } from '../data-access/homework-api';
import { MyHomeworkSummary, MyTask } from '../data-access/homework.models';
import { T } from '../i18n/texts';

/** How many reviewed tasks «Проверено недавно» shows (ours). */
const RECENT = 3;

/**
 * Student's home (spec §10.4): «Сдать» — the open tasks as tonal rows, the nearest deadline first, with
 * «Открыть» (or «Исправить» for a returned one); «Проверено недавно» — the latest reviewed tasks with a status chip.
 * The reviewed ones are loaded here: the summary has only the open tasks.
 */
@Component({
  selector: 'tb-my-deadlines-widget',
  imports: [Button, DatePipe, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tb-hw-section" [attr.aria-labelledby]="'tb-hw-due'">
      <h2 id="tb-hw-due" class="tb-hw-section__title">{{ t.title }}</h2>
      @if (summary().upcoming.length === 0) {
        <p class="tb-hw-empty">{{ t.nothing }}</p>
      } @else {
        <ul class="tb-list tb-list--no-phone-lead">
          @for (task of summary().upcoming; track task.taskId) {
            <li>
              <span
                class="tb-list__lead"
                [class.tb-list__lead--accent]="task.overdue"
                aria-hidden="true"
                ><i
                  class="tb-i"
                  [class.tb-i-assignment]="task.status !== 'RETURNED'"
                  [class.tb-i-assignment_return]="task.status === 'RETURNED'"
                ></i
              ></span>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ task.title }}</span>
                <span class="tb-list__supporting">
                  @if (task.dueAt !== null) {
                    {{ t.until((task.dueAt | date: 'dd.MM.yyyy HH:mm') ?? '') }}
                  } @else {
                    {{ noDueDate }}
                  }
                  @if (task.overdue) {
                    · {{ overdueLabel }}
                  }
                </span>
              </div>
              <div class="tb-list__trail">
                <p-button
                  [label]="task.status === 'RETURNED' ? t.fix : t.openTask"
                  [severity]="task.status === 'RETURNED' ? 'secondary' : 'primary'"
                  (onClick)="open(task)"
                />
              </div>
            </li>
          }
        </ul>
      }
    </section>

    @if (recent().length > 0) {
      <section class="tb-hw-section" aria-labelledby="tb-hw-recent">
        <h2 id="tb-hw-recent" class="tb-hw-section__title">{{ t.recent }}</h2>
        <ul class="tb-list tb-list--no-phone-lead">
          @for (task of recent(); track task.taskId) {
            <li>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ task.title }}</span>
                @if (task.reviewedAt !== null) {
                  <span class="tb-list__supporting">{{
                    task.reviewedAt | date: 'dd.MM.yyyy'
                  }}</span>
                }
              </div>
              <div class="tb-list__trail">
                <p-tag [value]="accepted(task)" severity="success" />
              </div>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-6);
    }

    .tb-hw-section {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
    }

    .tb-hw-section__title {
      margin: 0;
      font: var(--tb-type-title-m);
    }

    .tb-hw-empty {
      margin: 0;
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--tb-list-item);
      color: var(--p-md-on-surface-variant);
    }
  `,
})
export class MyDeadlinesWidget implements OnInit {
  protected readonly overdueLabel = T.overdue;
  protected readonly noDueDate = T.noDueDate;
  protected readonly t = T.deadlines;
  private readonly api = inject(HomeworkApi);
  private readonly router = inject(Router);

  readonly summary = input.required<MyHomeworkSummary>();

  private readonly tasks = signal<readonly MyTask[]>([]);
  /** The latest reviewed tasks, the newest first. */
  protected readonly recent = computed(() =>
    this.tasks()
      .filter((task) => task.status === 'ACCEPTED' && task.reviewedAt !== null)
      .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))
      .slice(0, RECENT),
  );

  ngOnInit(): void {
    this.api.myTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
      },
      error: () => {
        // without the list «Проверено недавно» stays hidden
      },
    });
  }

  protected accepted(task: MyTask): string {
    return task.grade === null ? T.statuses.ACCEPTED : `${T.statuses.ACCEPTED} · ${task.grade}`;
  }

  protected open(task: MyTask): void {
    void this.router.navigate(['/cabinet/homework', task.taskId]);
  }
}
