import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Menu } from 'primeng/menu';
import { Snackbar } from '@core/snackbar/snackbar';
import { HelpButton } from '@features/help/parts';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentSummary } from '../data-access/homework.models';
import { isDone } from '../homework-labels';
import { AssignmentActions, AssignmentList } from './assignment-list';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { T } from '../i18n/texts';

/**
 * Teacher: the assignments in two cards — «Активные» (not all the work accepted yet) and «Выполненные»
 * (every task accepted), each with a search and pages. A row: the title, who has it and the due date, a
 * badge of the progress and the actions under «⋮» (open, edit, review, open the board, delete).
 */
@Component({
  selector: 'tb-assignments-page',
  imports: [
    EmptyState,
    HelpButton,
    Button,
    Card,
    ConfirmDialog,
    Menu,
    AssignmentList,
    PageHeader,
    LoadStateView,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="teacher/homework" />
      <p-button class="tb-page-fab" [label]="t.create" icon="pi pi-plus" (onClick)="openCreate()" />
    </tb-page-header>

    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      @if (assignments().length > 0) {
        <div class="tb-stack">
          <tb-assignment-list
            [heading]="t.active"
            [reviewFilter]="true"
            [assignments]="active()"
            [emptyTitle]="t.noActiveTitle"
            [emptyHint]="t.noActiveHint"
            [menuFor]="menuFor()?.id ?? null"
            (actions)="openMenu($event)"
          />
          <tb-assignment-list
            [heading]="t.done"
            [assignments]="done()"
            emptyIcon="pi-check-circle"
            [emptyTitle]="t.noDoneTitle"
            [emptyHint]="t.noDoneHint"
            [menuFor]="menuFor()?.id ?? null"
            (actions)="openMenu($event)"
          />
        </div>
      } @else {
        <p-card>
          <h2 class="tb-sr-only">{{ t.title }}</h2>
          <tb-empty-state icon="pi-pen-to-square" [title]="t.emptyTitle" [hint]="t.emptyHint" />
        </p-card>
      }
    </tb-load-state>

    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
    <p-confirmdialog />
  `,
})
export class AssignmentsPage implements OnInit {
  protected readonly t = T.list;
  private readonly api = inject(HomeworkApi);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);
  private readonly menu = viewChild.required<Menu>('menu');

  protected readonly assignments = signal<AssignmentSummary[]>([]);
  protected readonly state = new LoadState();
  /** The assignment whose «⋮» menu is open: one popup menu serves every card. */
  protected readonly menuFor = signal<AssignmentSummary | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const assignment = this.menuFor();
    return assignment === null ? [] : this.actionsOf(assignment);
  });
  /** Not all the work accepted yet (or not given at all). */
  protected readonly active = computed(() =>
    this.assignments().filter((assignment) => !isDone(assignment)),
  );
  /** Every task of the assignment is accepted («Принято»). */
  protected readonly done = computed(() => this.assignments().filter(isDone));
  /** `?create=...` from the quick actions of the home page: opens the editor at once. */
  readonly create = input<string>();

  ngOnInit(): void {
    if (this.create() === 'assignment') {
      void this.router.navigate(['/teacher/homework/new'], { replaceUrl: true });
      return;
    }
    this.load();
  }

  protected openCreate(): void {
    void this.router.navigate(['/teacher/homework/new']);
  }

  protected load(): void {
    this.api
      .assignments()
      .pipe(this.state.track())
      .subscribe((assignments) => {
        this.assignments.set(assignments);
      });
  }

  protected openMenu({ assignment, event }: AssignmentActions): void {
    this.menuFor.set(assignment);
    this.menu().toggle(event);
  }

  private actionsOf(assignment: AssignmentSummary): MenuItem[] {
    return [
      {
        label: T.list.open,
        icon: 'pi pi-eye',
        command: () => void this.router.navigate(['/teacher/homework', assignment.id]),
      },
      {
        label: T.list.edit,
        icon: 'pi pi-pencil',
        command: () => void this.router.navigate(['/teacher/homework', assignment.id, 'edit']),
      },
      ...(assignment.submitted > 0
        ? [
            {
              label: T.list.review,
              icon: 'pi pi-check-square',
              command: () => void this.router.navigate(['/teacher/homework/review']),
            },
          ]
        : []),
      ...(assignment.boardId === null
        ? []
        : [
            {
              label: T.list.openBoard,
              icon: 'pi pi-arrow-up-right',
              command: () => void this.router.navigate(['/teacher/boards', assignment.boardId]),
            },
          ]),
      {
        label: T.remove.action,
        icon: 'pi pi-trash',
        styleClass: 'tb-menu-item--danger',
        command: () => {
          this.confirmRemove(assignment);
        },
      },
    ];
  }

  /** Deletes the assignment with the answers and the files, after a confirmation. */
  private confirmRemove(assignment: AssignmentSummary): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.remove.header,
        message: T.remove.message(assignment.title),
        acceptLabel: T.remove.confirm,
        accept: () => {
          this.api.deleteAssignment(assignment.id).subscribe(() => {
            this.assignments.update((all) =>
              all.filter((candidate) => candidate.id !== assignment.id),
            );
            this.snackbar.success(T.remove.deleted(assignment.title));
          });
        },
      }),
    );
  }
}
