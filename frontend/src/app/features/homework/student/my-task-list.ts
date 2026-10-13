import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { EmptyState } from '@shared/ui/empty-state';
import { SearchField } from '@shared/ui/search-field';
import { MyTask } from '../data-access/homework.models';
import { TaskStatusTag } from '../ui/task-status-tag';
import { T } from '../i18n/texts';

/** Rows of a page, as in the teacher's lists. */
const PAGE = 10;

/**
 * A card of the student's tasks («Активные» or «Выполненные»), as the teacher's: a search by the title and
 * the rows page by page — the title, the due date (red when overdue) and the status.
 */
@Component({
  selector: 'tb-my-task-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Card,
    Paginator,
    EmptyState,
    SearchField,
    TaskStatusTag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="heading()">
      @if (tasks().length > 0) {
        <div class="tb-toolbar">
          <tb-search-field
            [formControl]="search"
            [label]="t.searchIn(heading())"
            [placeholder]="t.search"
          />
        </div>
      }
      @if (page().length > 0) {
        <ul class="tb-list" [attr.aria-label]="heading()">
          @for (task of page(); track task.taskId) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i class="pi pi-pen-to-square"></i
              ></span>
              <div class="tb-list__text">
                <a class="tb-list__title tb-link" [routerLink]="[task.taskId]">{{ task.title }}</a>
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
        @if (found().length > rows) {
          <p-paginator
            [first]="first()"
            [rows]="rows"
            [totalRecords]="found().length"
            [pageLinkSize]="3"
            (onPageChange)="turn($event)"
          />
        }
      } @else if (tasks().length > 0) {
        <tb-empty-state
          [compact]="true"
          icon="pi-search"
          [title]="t.notFoundTitle"
          [hint]="t.notFoundHint"
        />
      } @else {
        <tb-empty-state
          [compact]="true"
          [icon]="emptyIcon()"
          [title]="emptyTitle()"
          [hint]="emptyHint()"
        />
      }
    </p-card>
  `,
})
export class MyTaskList {
  protected readonly t = T.mine;
  private readonly dates = new DatePipe(inject(LOCALE_ID));
  protected readonly rows = PAGE;

  readonly heading = input.required<string>();
  readonly tasks = input.required<readonly MyTask[]>();
  readonly emptyIcon = input('pi-pen-to-square');
  readonly emptyTitle = input.required<string>();
  readonly emptyHint = input('');

  protected readonly search = new FormControl('', { nonNullable: true });
  private readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  /** The first row of the shown page; a new search starts from the first page. */
  private readonly start = signal({ query: '', first: 0 });

  /** The tasks whose title has the search text. */
  protected readonly found = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return query === ''
      ? this.tasks()
      : this.tasks().filter((task) => task.title.toLocaleLowerCase().includes(query));
  });
  protected readonly first = computed(() => {
    const start = this.start();
    const first = start.query === this.query() ? start.first : 0;
    const last = Math.max(0, Math.ceil(this.found().length / this.rows) - 1) * this.rows;
    return Math.min(first, last);
  });
  protected readonly page = computed(() =>
    this.found().slice(this.first(), this.first() + this.rows),
  );

  protected turn(state: PaginatorState): void {
    this.start.set({ query: this.query(), first: state.first ?? 0 });
  }

  /** «до 12.10.2026 18:00» or «без срока». */
  protected due(task: MyTask): string {
    return task.dueAt === null
      ? T.noDueDate
      : T.list.until(this.dates.transform(task.dueAt, 'dd.MM.yyyy HH:mm') ?? '');
  }
}
