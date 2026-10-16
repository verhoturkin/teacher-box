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
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { EmptyState } from '@shared/ui/empty-state';
import { AssignmentSummary } from '../data-access/homework.models';
import { assignmentProgress } from '../homework-labels';
import { T } from '../i18n/texts';
import { SearchField } from '@shared/ui/search-field';

/** Names shown in a row before «и ещё N». */
const SHOWN_STUDENTS = 3;
/** Rows of a page. */
export const ASSIGNMENTS_PAGE = 10;

/** «⋮» of a row was pressed: the page shows one menu for every list. */
export interface AssignmentActions {
  readonly assignment: AssignmentSummary;
  readonly event: Event;
}

/**
 * A card of the teacher's assignments («Активные» or «Выполненные»): search by the title or a
 * student's name, the rows page by page — the title, who has it and the due date, the progress and «⋮».
 */
@Component({
  selector: 'tb-assignment-list',
  imports: [
    SearchField,
    ReactiveFormsModule,
    RouterLink,
    Button,
    Card,
    Paginator,
    Tag,
    Tooltip,
    ButtonAttributes,
    EmptyState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="heading()">
      @if (assignments().length > 0) {
        <div class="tb-toolbar">
          <tb-search-field
            [formControl]="search"
            [label]="t.searchIn(heading())"
            [placeholder]="t.search"
          />
          @if (reviewFilter() && (toReview() > 0 || onlyReview())) {
            <p-button
              [label]="t.toReview"
              icon="tb-i tb-i-filter_list"
              [severity]="onlyReview() ? 'primary' : 'secondary'"
              [badge]="toReview() > 0 ? toReview().toString() : undefined"
              badgeSeverity="warn"
              [tbAttributes]="{ 'aria-pressed': onlyReview() ? 'true' : 'false' }"
              (onClick)="onlyReview.update((on) => !on)"
            />
          }
        </div>
      }
      @if (page().length > 0) {
        <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="heading()">
          @for (assignment of page(); track assignment.id) {
            <li>
              <span class="tb-list__lead" aria-hidden="true"
                ><i
                  [class]="
                    assignment.boardId === null ? 'tb-i tb-i-assignment' : 'tb-i tb-i-co_present'
                  "
                ></i
              ></span>
              <div class="tb-list__text">
                <a class="tb-list__title tb-link" [routerLink]="[assignment.id]">{{
                  assignment.title
                }}</a>
                <span class="tb-list__supporting">{{ details(assignment) }}</span>
              </div>
              <div class="tb-list__trail tb-list__trail--icons">
                @if (progress(assignment); as badge) {
                  <p-tag [value]="badge.label" [severity]="badge.severity" />
                }
                <p-button
                  icon="tb-i tb-i-more_vert"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [pTooltip]="t.actions(assignment.title)"
                  [ariaLabel]="t.actions(assignment.title)"
                  [tbAttributes]="{
                    'aria-haspopup': 'menu',
                    'aria-expanded': menuFor() === assignment.id ? 'true' : 'false',
                  }"
                  (onClick)="actions.emit({ assignment, event: $event })"
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
      } @else if (onlyReview() && query().trim() === '') {
        <tb-empty-state [compact]="true" icon="tb-i-check" [title]="t.nothingToReview" />
      } @else if (assignments().length > 0) {
        <tb-empty-state
          [compact]="true"
          icon="tb-i-search"
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
  styles: `
    /* «На проверку» is in the row of the search, at its end; on a phone it goes under the search */
    .tb-toolbar > p-button {
      margin-left: auto;

      @media (width <= 48em) {
        margin-left: 0;
      }
    }
  `,
})
export class AssignmentList {
  protected readonly t = T.list;
  private readonly dates = new DatePipe(inject(LOCALE_ID));
  protected readonly rows = ASSIGNMENTS_PAGE;
  protected readonly progress = assignmentProgress;

  readonly heading = input.required<string>();
  readonly assignments = input.required<readonly AssignmentSummary[]>();
  readonly emptyIcon = input('tb-i-assignment');
  readonly emptyTitle = input.required<string>();
  readonly emptyHint = input('');
  /** «На проверку»: a toggle that leaves only the assignments with work to review. */
  readonly reviewFilter = input(false);
  /** The assignment whose «⋮» menu is open. */
  readonly menuFor = input<string | null>(null);
  readonly actions = output<AssignmentActions>();

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly query = toSignal(this.search.valueChanges, { initialValue: '' });
  protected readonly onlyReview = signal(false);
  /** Works waiting for a review in the list. */
  protected readonly toReview = computed(() =>
    this.assignments().reduce((sum, assignment) => sum + assignment.submitted, 0),
  );
  /** What is shown: a new search or filter starts from the first page. */
  private readonly filter = computed(() => `${String(this.onlyReview())}|${this.query()}`);
  /** The first row of the shown page. */
  private readonly start = signal({ filter: 'false|', first: 0 });

  /** The assignments whose title or a student's name has the search text (with work to review). */
  protected readonly found = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    const shown = this.onlyReview()
      ? this.assignments().filter((assignment) => assignment.submitted > 0)
      : this.assignments();
    return query === ''
      ? shown
      : shown.filter(
          (assignment) =>
            assignment.title.toLocaleLowerCase().includes(query) ||
            assignment.students.some((name) => name.toLocaleLowerCase().includes(query)),
        );
  });
  protected readonly first = computed(() => {
    const start = this.start();
    const first = start.filter === this.filter() ? start.first : 0;
    // a deleted row may leave the last page empty: show the one before
    const last = Math.max(0, Math.ceil(this.found().length / this.rows) - 1) * this.rows;
    return Math.min(first, last);
  });
  protected readonly page = computed(() =>
    this.found().slice(this.first(), this.first() + this.rows),
  );

  protected turn(state: PaginatorState): void {
    this.start.set({ filter: this.filter(), first: state.first ?? 0 });
  }

  /** «Анна, Борис и ещё 2 · до 12.10.2026 18:00». */
  protected details(assignment: AssignmentSummary): string {
    const names = assignment.students;
    const who =
      names.length === 0
        ? T.list.nobody
        : names.length > SHOWN_STUDENTS + 1
          ? T.list.andMore(names.slice(0, SHOWN_STUDENTS).join(', '), names.length - SHOWN_STUDENTS)
          : names.join(', ');
    const due =
      assignment.dueAt === null
        ? T.noDueDate
        : T.list.until(this.dates.transform(assignment.dueAt, 'dd.MM.yyyy HH:mm') ?? '');
    return `${who} · ${due}`;
  }
}
