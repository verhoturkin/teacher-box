import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { RowType } from '@shared/ui/row-type.directive';
import { AssignmentSummary } from '@features/homework/data-access/homework.models';
import { assignmentProgress } from '@features/homework/homework-labels';
import { T } from '@features/homework/i18n/texts';
import { Material, materialLabel, materialsOf } from '@features/homework/ui/materials';
import { DeadlineKey } from '../deadline-groups';

/** Names a row shows in full; more of them — the first one and «и ещё N» (one row keeps its height). */
const SHOWN_STUDENTS = 2;

/** A run of rows under one heading; `key` — the due-date group, `null` — the heading is left out. */
export interface Section {
  readonly key: DeadlineKey | null;
  readonly title: string | null;
  readonly rows: readonly AssignmentSummary[];
}

/** A line of the table: a group heading or an assignment. */
export interface Line {
  readonly section: Section;
  readonly assignment: AssignmentSummary | null;
}

/** The «⋮» of a row was pressed. */
export interface RowMenu {
  readonly assignment: AssignmentSummary;
  readonly event: Event;
}

/**
 * The assignments of the homework list, grouped by the due date: a table from expanded, tiles with the bar
 * on medium and cards on a phone; «⋮» of a row — its actions.
 */
@Component({
  selector: 'tb-assignments-table',
  imports: [
    NgTemplateOutlet,
    Button,
    ButtonAttributes,
    RouterLink,
    RowType,
    TableModule,
    Tag,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    @if (mobile() || medium()) {
      @for (section of sections(); track section.key) {
        @if (section.title; as title) {
          <h2 class="tb-hw__label tb-hw__group" [class.tb-error]="section.key === 'overdue'">
            {{ title }}
          </h2>
        }
        <ul class="tb-list tb-list--clamp" [attr.aria-label]="section.title ?? t.title">
          @for (assignment of section.rows; track assignment.id) {
            <li>
              @if (medium()) {
                <span class="tb-list__lead" aria-hidden="true"
                  ><i
                    [class]="
                      assignment.boardId === null ? 'tb-i tb-i-assignment' : 'tb-i tb-i-co_present'
                    "
                  ></i
                ></span>
              }
              <div class="tb-list__text">
                <a
                  class="tb-list__title tb-list__link"
                  [routerLink]="['/teacher/homework', assignment.id]"
                  >{{ assignment.title }}</a
                >
                <span class="tb-list__supporting">{{ details(assignment) }}</span>
                @if (!medium()) {
                  <ng-container
                    [ngTemplateOutlet]="handed"
                    [ngTemplateOutletContext]="{ assignment }"
                  />
                }
              </div>
              <div class="tb-list__trail tb-list__trail--icons tb-hw__row-end">
                @if (medium()) {
                  <span class="tb-hw__tile-handed">
                    <ng-container
                      [ngTemplateOutlet]="handed"
                      [ngTemplateOutletContext]="{ assignment }"
                    />
                  </span>
                }
                @if (progress(assignment); as badge) {
                  <p-tag [value]="badge.label" [severity]="badge.severity" />
                }
                <ng-container
                  [ngTemplateOutlet]="rowMenu"
                  [ngTemplateOutletContext]="{ assignment }"
                />
              </div>
            </li>
          }
        </ul>
      }
    } @else {
      <p-table [value]="lines()" styleClass="tb-cards tb-hw__table">
        <ng-template #header>
          <tr>
            <th class="tb-col-main">{{ t.columns.task }}</th>
            <th>{{ t.columns.whom }}</th>
            <th>{{ t.columns.due }}</th>
            <th>{{ t.columns.handed }}</th>
            <th>{{ t.columns.status }}</th>
            <th>
              <span class="tb-sr-only">{{ t.columns.actions }}</span>
            </th>
          </tr>
        </ng-template>
        <ng-template #body let-line [tbRowType]="lines()">
          @if (line.assignment; as assignment) {
            <tr>
              <td>
                <div class="tb-hw__task">
                  <span class="tb-list__lead" aria-hidden="true"
                    ><i
                      [class]="
                        assignment.boardId === null
                          ? 'tb-i tb-i-assignment'
                          : 'tb-i tb-i-co_present'
                      "
                    ></i
                  ></span>
                  <div class="tb-list__text">
                    <a
                      class="tb-list__title tb-link"
                      [routerLink]="['/teacher/homework', assignment.id]"
                      >{{ assignment.title }}</a
                    >
                    <span class="tb-hw__materials">
                      @for (material of materials(assignment); track material.icon) {
                        <span
                          class="tb-hw__material"
                          role="img"
                          [attr.aria-label]="materialLabel(material)"
                          [pTooltip]="materialLabel(material)"
                        >
                          <i [class]="material.icon" aria-hidden="true"></i>
                          @if (material.count !== null) {
                            {{ material.count }}
                          }
                        </span>
                      }
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <span class="tb-hw__whom">
                  <i
                    [class]="
                      assignment.students.length > 1 ? 'tb-i tb-i-group' : 'tb-i tb-i-person'
                    "
                    aria-hidden="true"
                  ></i>
                  {{ whomOf(assignment) }}
                </span>
              </td>
              <td class="tb-hw__due" [class.tb-error]="isOverdue(assignment)">
                {{ due(assignment) }}
              </td>
              <td>
                <ng-container
                  [ngTemplateOutlet]="handed"
                  [ngTemplateOutletContext]="{ assignment }"
                />
              </td>
              <td>
                @if (progress(assignment); as badge) {
                  <p-tag [value]="badge.label" [severity]="badge.severity" />
                }
              </td>
              <td>
                <ng-container
                  [ngTemplateOutlet]="rowMenu"
                  [ngTemplateOutletContext]="{ assignment }"
                />
              </td>
            </tr>
          } @else {
            <tr class="tb-hw__group-row">
              <td colspan="6">
                <h2 class="tb-hw__label" [class.tb-error]="line.section.key === 'overdue'">
                  {{ line.section.title }}
                </h2>
              </td>
            </tr>
          }
        </ng-template>
      </p-table>
    }

    <ng-template #handed let-assignment="assignment">
      @if (assignment.totalTasks > 0) {
        <span class="tb-hw__handed">
          <span
            class="tb-hw__bar"
            role="img"
            [attr.aria-label]="t.handedOf(handedCount(assignment), assignment.totalTasks)"
          >
            <span [style.inline-size.%]="share(assignment.accepted, assignment)"></span>
            <span
              class="tb-hw__bar-awaiting"
              [style.inline-size.%]="share(assignment.submitted, assignment)"
            ></span>
          </span>
          <span class="tb-muted">{{
            t.handedOf(handedCount(assignment), assignment.totalTasks)
          }}</span>
        </span>
      }
    </ng-template>

    <ng-template #rowMenu let-assignment="assignment">
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
        (onClick)="menu.emit({ assignment, event: $event })"
      />
    </ng-template>
  `,
  styles: `
    /* «⋮» sits at the right edge of the row */
    :host ::ng-deep .tb-hw__table td:last-child:not([colspan]) {
      text-align: end;
    }

    /* a label over a block (M3 \`label medium\`, upper case) */
    .tb-hw__label {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-hw__label.tb-error {
      color: var(--p-md-error);
    }

    .tb-hw__group {
      margin-block: var(--tb-space-5) var(--tb-space-2);
    }

    /* the group heading is not a tile; the tiles round their own corners again around it */
    .tb-hw__group-row > td {
      block-size: auto;
      padding-block: var(--tb-space-4) var(--tb-space-1);
    }

    :host ::ng-deep .tb-hw__table .p-datatable-tbody > tr.tb-hw__group-row + tr > td:first-child {
      border-start-start-radius: var(--tb-list-outer);
    }

    :host ::ng-deep .tb-hw__table .p-datatable-tbody > tr.tb-hw__group-row + tr > td:last-child {
      border-start-end-radius: var(--tb-list-outer);
    }

    :host
      ::ng-deep
      .tb-hw__table
      .p-datatable-tbody
      > tr:has(+ tr.tb-hw__group-row)
      > td:first-child {
      border-end-start-radius: var(--tb-list-outer);
    }

    :host
      ::ng-deep
      .tb-hw__table
      .p-datatable-tbody
      > tr:has(+ tr.tb-hw__group-row)
      > td:last-child {
      border-end-end-radius: var(--tb-list-outer);
    }

    .tb-hw__task {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
    }

    .tb-hw__materials {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-3);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-hw__material {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
    }

    .tb-hw__material i {
      font-size: 1rem;
    }

    /* block-level flex: an inline box would leave the line strut and sit off the row's centre */
    .tb-hw__whom {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-hw__handed {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      white-space: nowrap;
    }

    .tb-hw__due {
      white-space: nowrap;
    }

    /* accepted — the portal colour, handed in and waiting for review — tertiary */
    .tb-hw__bar {
      display: flex;
      inline-size: 7rem;
      block-size: 0.5rem;
      border-radius: var(--tb-shape-xs);
      background: var(--p-md-surface-container-highest);
      overflow: hidden;
    }

    /* below expanded the table has no room for the bar: the count says the same */
    @media (width < 60em) {
      .tb-hw__bar {
        display: none;
      }
    }

    .tb-hw__bar > span {
      background: var(--p-md-primary);
    }

    .tb-hw__bar > .tb-hw__bar-awaiting {
      background: var(--p-md-tertiary);
    }

    /* a tile of medium: the bar is back (the table hides it below expanded), the count under it */
    .tb-hw__tile-handed .tb-hw__handed {
      flex-direction: column;
      align-items: flex-end;
      gap: var(--tb-space-1);
    }

    .tb-hw__tile-handed .tb-hw__bar {
      display: flex;
      inline-size: 6rem;
    }

    .tb-hw__tile-handed .tb-muted {
      font: var(--tb-type-body-s);
    }

    /* the badge and «⋮» side by side */
    .tb-hw__row-end {
      flex-direction: row;
      align-items: center;
    }
  `,
})
export class AssignmentsTable {
  protected readonly t = T.list;
  protected readonly progress = assignmentProgress;
  protected readonly materialLabel = materialLabel;
  private readonly dates = new DatePipe(inject(LOCALE_ID));

  readonly sections = input.required<readonly Section[]>();
  /** The same rows for the table: a heading line before the rows of each group. */
  readonly lines = input.required<Line[]>();
  readonly mobile = input.required<boolean>();
  /** Medium (600–839): the list is tiles with the bar, not the table. */
  readonly medium = input.required<boolean>();
  /** The moment the lists were read: a due date before it is overdue. */
  readonly now = input.required<number>();
  /** The assignment whose «⋮» menu is open. */
  readonly menuFor = input.required<string | null>();
  readonly menu = output<RowMenu>();

  /** The due date has passed and somebody has not handed in yet. */
  protected isOverdue(assignment: AssignmentSummary): boolean {
    return (
      assignment.dueAt !== null &&
      new Date(assignment.dueAt).getTime() < this.now() &&
      assignment.assigned + assignment.returned > 0
    );
  }

  /** Handed in (waiting for review or accepted). */
  protected handedCount(assignment: AssignmentSummary): number {
    return assignment.submitted + assignment.accepted;
  }

  /** The width of the progress bar a number of tasks takes, in percent. */
  protected share(count: number, assignment: AssignmentSummary): number {
    return assignment.totalTasks === 0 ? 0 : (count / assignment.totalTasks) * 100;
  }

  /** The materials of the assignment the row shows (the ones it has). */
  protected materials(assignment: AssignmentSummary): Material[] {
    return materialsOf(assignment, assignment.boardId !== null);
  }

  /** «Анна и ещё 3». */
  protected whomOf(assignment: AssignmentSummary): string {
    const names = assignment.students;
    return names.length === 0
      ? this.t.nobody
      : names.length > SHOWN_STUDENTS
        ? this.t.andMore(names[0] ?? '', names.length - 1)
        : names.join(', ');
  }

  /** «12.10 18:00»; the year only when it is not the current one. */
  protected due(assignment: AssignmentSummary): string {
    return this.dueOf(assignment.dueAt, false);
  }

  /** «Анна и ещё 3 · до 12.10 18:00»: a card of a phone. */
  protected details(assignment: AssignmentSummary): string {
    return `${this.whomOf(assignment)} · ${this.dueOf(assignment.dueAt, true)}`;
  }

  private dueOf(dueAt: string | null, prefixed: boolean): string {
    if (dueAt === null) {
      return T.noDueDate;
    }
    const year = (moment: string | number): string | null => this.dates.transform(moment, 'yyyy');
    const format = year(dueAt) === year(this.now()) ? 'dd.MM HH:mm' : 'dd.MM.yyyy HH:mm';
    const text = this.dates.transform(dueAt, format) ?? '';
    return prefixed ? this.t.until(text) : text;
  }
}
