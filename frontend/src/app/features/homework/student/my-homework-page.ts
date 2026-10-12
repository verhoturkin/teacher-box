import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { HelpButton } from '@features/help/parts';
import { HomeworkApi } from '../data-access/homework-api';
import { MyTask } from '../data-access/homework.models';
import { TaskStatusTag } from '../ui/task-status-tag';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { PageHeader } from '@shared/ui/page-header';
import { T } from '../i18n/texts';

/** Student: own tasks as cards like the teacher's list; the ones that need work come first. */
@Component({
  selector: 'tb-my-homework-page',
  imports: [EmptyState, HelpButton, RouterLink, Card, TaskStatusTag, LoadStateView, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="cabinet/homework" />
    </tb-page-header>
    <p-card>
      <h2 class="tb-sr-only">{{ t.title }}</h2>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (tasks().length > 0) {
          <ul class="tb-list" [attr.aria-label]="t.title">
            @for (task of tasks(); track task.taskId) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i class="pi pi-pen-to-square"></i
                ></span>
                <div class="tb-list__text">
                  <a class="tb-list__title tb-link" [routerLink]="[task.taskId]">{{
                    task.title
                  }}</a>
                  <span class="tb-list__supporting" [class.tb-negative]="task.overdue">{{
                    due(task)
                  }}</span>
                </div>
                <div class="tb-list__trail tb-list__trail--icons">
                  <tb-task-status
                    [status]="task.status"
                    [overdue]="task.overdue"
                    [grade]="task.grade"
                  />
                </div>
              </li>
            }
          </ul>
        } @else {
          <tb-empty-state icon="pi-pen-to-square" [title]="t.emptyTitle" [hint]="t.emptyHint" />
        }
      </tb-load-state>
    </p-card>
  `,
})
export class MyHomeworkPage implements OnInit {
  protected readonly t = T.mine;
  private readonly api = inject(HomeworkApi);
  private readonly dates = new DatePipe(inject(LOCALE_ID));

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

  /** «до 12.10.2026 18:00» or «без срока». */
  protected due(task: MyTask): string {
    return task.dueAt === null
      ? T.noDueDate
      : T.list.until(this.dates.transform(task.dueAt, 'dd.MM.yyyy HH:mm') ?? '');
  }
}
