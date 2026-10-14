import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Card } from 'primeng/card';
import { HelpButton } from '@features/help/parts';
import { HomeworkApi } from '../data-access/homework-api';
import { MyTask } from '../data-access/homework.models';
import { MyTaskList } from './my-task-list';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { T } from '../i18n/texts';

/**
 * Student: own tasks in two cards like the teacher's — «Активные» (not accepted yet; the ones that need work
 * first) and «Выполненные» (accepted), each with a search by the title and pages.
 */
@Component({
  selector: 'tb-my-homework-page',
  imports: [EmptyState, HelpButton, Card, MyTaskList, LoadStateView, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="cabinet/homework" />
    </tb-page-header>
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (tasks().length > 0) {
        <div class="tb-stack">
          <tb-my-task-list
            [heading]="t.active"
            [tasks]="active()"
            [emptyTitle]="t.noActiveTitle"
            [emptyHint]="t.noActiveHint"
          />
          <tb-my-task-list
            [heading]="t.done"
            [tasks]="done()"
            emptyIcon="tb-i-check_circle"
            [emptyTitle]="t.noDoneTitle"
            [emptyHint]="t.noDoneHint"
          />
        </div>
      } @else {
        <p-card>
          <h2 class="tb-sr-only">{{ t.title }}</h2>
          <tb-empty-state icon="tb-i-assignment" [title]="t.emptyTitle" [hint]="t.emptyHint" />
        </p-card>
      }
    </tb-load-state>
  `,
})
export class MyHomeworkPage implements OnInit {
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

  /** Not accepted yet: to do, handed in or returned. */
  protected readonly active = computed(() =>
    this.tasks().filter((task) => task.status !== 'ACCEPTED'),
  );
  /** Accepted by the teacher («Принято»). */
  protected readonly done = computed(() =>
    this.tasks().filter((task) => task.status === 'ACCEPTED'),
  );

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
