import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { TeacherColors } from '@features/identity/parts';
import { toIsoDate } from '@shared/dates/iso-date';
import { Avatar } from '@shared/ui/avatar';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { AssignMoreDialog } from './assign-more-dialog';
import { HomeworkApi } from '../data-access/homework-api';
import { Journal, JournalCell, JournalColumn, JournalRow } from '../data-access/homework.models';
import { T } from '../i18n/texts';

const WEEK_DAYS = 7;

/** The Monday of the week a date falls on, at the start of the day. */
function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % WEEK_DAYS));
  return monday;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** How a cell looks: the colour role, the icon and the words. */
interface CellView {
  readonly kind: 'ok' | 'review' | 'bad' | 'wait' | 'none';
  readonly icon: string;
  readonly text: string;
}

/**
 * «По ученикам»: a week of the homework as a grid (rows — students, columns — assignments due that week).
 * A cell is a button coloured by the status of the work (success / warning / error containers, calm surface for
 * «ждём», outline for «не выдано»): a work waiting for review opens its review, an empty cell gives the
 * assignment to the student («Выдать ещё»), any other opens the assignment. On a narrow window the grid
 * scrolls sideways and the column of students stays in place. The «Кому» control comes from the page
 * (`<div whom>`).
 */
@Component({
  selector: 'tb-journal-view',
  imports: [Avatar, AssignMoreDialog, Button, EmptyState, LoadStateView, RouterLink, Tooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-toolbar tb-journal__toolbar">
      <p-button
        icon="tb-i tb-i-chevron_left"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        [pTooltip]="t.previousWeek"
        [ariaLabel]="t.previousWeek"
        (onClick)="shift(-1)"
      />
      <h2 class="tb-journal__range" aria-live="polite">
        {{ range() }}
      </h2>
      <p-button
        icon="tb-i tb-i-chevron_right"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        [pTooltip]="t.nextWeek"
        [ariaLabel]="t.nextWeek"
        (onClick)="shift(1)"
      />
      <ng-content select="[whom]" />
      <ul class="tb-journal__legend" [attr.aria-label]="t.legend">
        @for (item of legend; track item.kind) {
          <li>
            <span
              class="tb-journal__dot"
              [class]="'tb-journal__dot tb-journal--' + item.kind"
            ></span>
            {{ item.label }}
          </li>
        }
      </ul>
    </div>

    <tb-load-state [state]="state" [what]="t.what" (retry)="reload()">
      @if (journal(); as data) {
        @if (data.assignments.length === 0 || data.students.length === 0) {
          <tb-empty-state icon="tb-i-grid_view" [title]="t.emptyTitle" [hint]="t.emptyHint" />
        } @else {
          <div class="tb-journal__scroll">
            <table class="tb-journal__grid">
              <thead>
                <tr>
                  <th scope="col" class="tb-journal__who">{{ t.columnStudent }}</th>
                  @for (column of data.assignments; track column.id) {
                    <th scope="col">
                      <a class="tb-journal__task" [routerLink]="['/teacher/homework', column.id]">{{
                        column.title
                      }}</a>
                      <span class="tb-journal__due">{{ t.due(dueOf(column)) }}</span>
                    </th>
                  }
                  <th scope="col">{{ t.columnTotal }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of data.students; track row.studentId) {
                  <tr>
                    <th scope="row" class="tb-journal__who">
                      <span class="tb-journal__student">
                        <tb-avatar
                          [attr.data-tb-label]="colors.studentLabel(row.studentId)"
                          [name]="row.studentName"
                          [photo]="row.studentAvatar"
                        />
                        {{ row.studentName }}
                      </span>
                    </th>
                    @for (cell of row.cells; track $index) {
                      <td>
                        @let view = viewOf(cell);
                        <button
                          type="button"
                          class="tb-journal__cell"
                          [class]="'tb-journal__cell tb-journal--' + view.kind"
                          [attr.aria-label]="
                            t.cellLabel(
                              row.studentName,
                              data.assignments[$index]?.title ?? '',
                              view.text
                            )
                          "
                          (click)="open(data, row, $index)"
                        >
                          <i [class]="view.icon" aria-hidden="true"></i>
                          {{ view.text }}
                        </button>
                      </td>
                    }
                    <td>
                      <div class="tb-journal__total">
                        <strong>{{ t.total(row.handedIn, row.given) }}</strong>
                        <span>{{ t.totalHint }}</span>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </tb-load-state>

    <tb-assign-more-dialog
      #assignMore
      [assignmentId]="target()?.id ?? ''"
      [assigned]="target()?.assigned ?? []"
      (saved)="reload()"
    />
  `,
  styles: `
    .tb-journal__toolbar {
      margin-block: var(--tb-space-4);
    }

    .tb-journal__range {
      margin: 0;
      font: var(--tb-type-title-l);
    }

    .tb-journal__legend {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-3);
      margin: 0 0 0 auto;
      padding: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      list-style: none;
    }

    .tb-journal__legend li {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-journal__dot {
      inline-size: 0.75rem;
      block-size: 0.75rem;
      border-radius: var(--tb-shape-xs);
    }

    /* the colour roles of a status: success, warning, error containers; calm surface; outline */
    .tb-journal--ok {
      background: var(--p-md-success-container);
      color: var(--p-md-on-success-container);
    }

    .tb-journal--review {
      background: var(--p-md-warning-container);
      color: var(--p-md-on-warning-container);
    }

    .tb-journal--bad {
      background: var(--p-md-error-container);
      color: var(--p-md-on-error-container);
    }

    .tb-journal--wait {
      background: var(--p-md-surface-container);
      color: var(--p-md-on-surface-variant);
    }

    .tb-journal--none {
      background: transparent;
      color: var(--p-md-on-surface-variant);
      outline: 1px dashed var(--p-md-outline-variant);
      outline-offset: -1px;
    }

    .tb-journal__scroll {
      overflow-x: auto;
    }

    .tb-journal__grid {
      inline-size: 100%;
      border-collapse: separate;
      border-spacing: var(--tb-space-1);
    }

    .tb-journal__grid th {
      padding: var(--tb-space-1) var(--tb-space-2);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      text-align: start;
      vertical-align: bottom;
    }

    /* every body row is one height: the student, the cells and the total are --tb-journal-row high */
    .tb-journal__grid {
      --tb-journal-row: 3.25rem;
    }

    .tb-journal__grid td {
      min-inline-size: 9rem;
      padding: 0;
      vertical-align: middle;
    }

    .tb-journal__grid tbody th {
      padding: 0;
      vertical-align: middle;
    }

    .tb-journal__task {
      display: block;
      color: var(--p-md-on-surface);
      font: var(--tb-type-title-s);
      text-decoration: none;
    }

    .tb-journal__task:hover {
      text-decoration: underline;
    }

    .tb-journal__due {
      font: var(--tb-type-body-s);
    }

    /* the student column stays while the grid scrolls sideways */
    .tb-journal__who {
      position: sticky;
      inset-inline-start: 0;
      z-index: 1;
      min-inline-size: 11rem;
      background: var(--p-md-surface);
    }

    .tb-journal__student {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      box-sizing: border-box;
      block-size: var(--tb-journal-row);
      padding: 0 var(--tb-space-3);
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-surface-container);
      color: var(--p-md-on-surface);
      font: var(--tb-type-title-s);
      white-space: nowrap;
    }

    .tb-journal__cell {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      inline-size: 100%;
      box-sizing: border-box;
      block-size: var(--tb-journal-row);
      padding: 0 var(--tb-space-3);
      border: 0;
      border-radius: var(--tb-shape-sm);
      font: var(--tb-type-label-l);
      text-align: start;
      cursor: pointer;
    }

    .tb-journal__cell:hover {
      filter: brightness(0.95);
    }

    .tb-journal__cell i {
      font-size: 1.125rem;
    }

    /* the head and the values of «За неделю» share one inline start and the values one vertical centre */
    .tb-journal__total {
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-sizing: border-box;
      block-size: var(--tb-journal-row);
      min-inline-size: 6rem;
      padding-inline: var(--tb-space-2);
    }

    .tb-journal__total span {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }
  `,
})
export class JournalView {
  protected readonly t = T.journal;
  protected readonly colors = inject(TeacherColors);
  private readonly api = inject(HomeworkApi);
  private readonly locale = inject(LOCALE_ID);

  /** The student or the group whose rows are shown (an id); `null` — everybody who has a task. */
  readonly who = input<string | null>(null);
  /** A work waiting for review was chosen. */
  readonly review = output<string>();
  /** An assignment was chosen. */
  readonly openAssignment = output<string>();

  protected readonly state = new LoadState();
  protected readonly journal = signal<Journal | null>(null);
  private readonly week = signal(mondayOf(new Date()));
  private readonly reloads = signal(0);
  protected readonly weekFrom = computed(() => this.week());
  protected readonly weekTo = computed(() => addDays(this.week(), WEEK_DAYS - 1));
  /** «27 октября — 2 ноября». */
  protected readonly range = computed(() => {
    const day = (date: Date): string => new DatePipe(this.locale).transform(date, 'd MMMM') ?? '';
    return this.t.range(day(this.weekFrom()), day(this.weekTo()));
  });
  /** The assignment whose «Выдать ещё» is open and who has it already. */
  protected readonly target = signal<{ id: string; assigned: string[] } | null>(null);
  private readonly assignMore = viewChild.required<AssignMoreDialog>('assignMore');

  protected readonly legend = [
    { kind: 'ok', label: T.journal.accepted },
    { kind: 'review', label: T.journal.toReview },
    { kind: 'bad', label: T.journal.late },
    { kind: 'wait', label: T.journal.waiting },
  ] as const;

  constructor() {
    toObservable(
      computed(() => ({
        from: toIsoDate(this.weekFrom()),
        to: toIsoDate(this.weekTo()),
        who: this.who(),
        reloads: this.reloads(),
      })),
    )
      .pipe(
        switchMap(({ from, to, who }) => this.api.journal(from, to, who).pipe(this.state.track())),
        takeUntilDestroyed(),
      )
      .subscribe((journal) => {
        this.journal.set(journal);
      });
  }

  protected shift(weeks: number): void {
    this.week.update((monday) => addDays(monday, weeks * WEEK_DAYS));
  }

  protected reload(): void {
    this.reloads.update((count) => count + 1);
  }

  protected dueOf(column: JournalColumn): string {
    return new DatePipe(this.locale).transform(column.dueAt, 'EEE dd.MM') ?? '';
  }

  protected viewOf(cell: JournalCell): CellView {
    switch (cell.status) {
      case 'ACCEPTED':
        return {
          kind: 'ok',
          icon: 'tb-i tb-i-check_circle',
          text: this.t.cellAccepted(cell.grade),
        };
      case 'TO_REVIEW':
        return {
          kind: 'review',
          icon: 'tb-i tb-i-rate_review',
          text: this.t.cellToReview(cell.quizScore, cell.quizMax),
        };
      case 'RETURNED':
        return { kind: 'bad', icon: 'tb-i tb-i-error', text: this.t.cellReturned };
      case 'OVERDUE':
        return {
          kind: 'bad',
          icon: 'tb-i tb-i-error',
          text: this.t.cellOverdue(cell.overdueDays ?? 1),
        };
      case 'WAITING':
        return { kind: 'wait', icon: 'tb-i tb-i-schedule', text: this.t.cellWaiting };
      case 'NOT_ASSIGNED':
        return { kind: 'none', icon: 'tb-i tb-i-add', text: this.t.cellNotAssigned };
    }
  }

  /** A work waiting for review opens its review, an empty cell opens «Выдать ещё», the others the assignment. */
  protected open(journal: Journal, row: JournalRow, index: number): void {
    const cell = row.cells[index];
    const column = journal.assignments[index];
    if (cell === undefined || column === undefined) {
      return;
    }
    if (cell.status === 'TO_REVIEW' && cell.taskId !== null) {
      this.review.emit(cell.taskId);
    } else if (cell.status === 'NOT_ASSIGNED') {
      this.target.set({
        id: column.id,
        assigned: journal.students
          .filter((student) => student.cells[index]?.taskId != null)
          .map((student) => student.studentId),
      });
      this.assignMore().open(row.studentId);
    } else {
      this.openAssignment.emit(column.id);
    }
  }
}
