import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Badge } from 'primeng/badge';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { Menu } from 'primeng/menu';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { ButtonAttributes } from '@shared/ui/button-attributes';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentSummary } from '../data-access/homework.models';
import { assignmentProgress } from '../homework-labels';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { T } from '../i18n/texts';

/** Names shown in a card before «и ещё N». */
const SHOWN_STUDENTS = 3;

/**
 * Teacher: all assignments as cards — the title, who has it and the due date, a badge of the progress and the
 * actions under «⋮».
 */
@Component({
  selector: 'tb-assignments-page',
  imports: [
    EmptyState,
    HelpButton,
    RouterLink,
    Badge,
    Button,
    ButtonDirective,
    ButtonLabel,
    ButtonAttributes,
    Card,
    Menu,
    Tag,
    Tooltip,
    PageHeader,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header [title]="t.title">
      <tb-help-button help topic="teacher/homework" />
      <a pButton routerLink="review" severity="secondary">
        <span pButtonLabel>{{ t.toReview }}</span>
        @if (toReview() > 0) {
          <p-badge [value]="toReview()" severity="warn" />
        }
      </a>
      <p-button class="tb-page-fab" [label]="t.create" icon="pi pi-plus" (onClick)="openCreate()" />
    </tb-page-header>

    <p-card>
      <h2 class="tb-sr-only">{{ t.title }}</h2>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (assignments().length > 0) {
          <ul class="tb-list" [attr.aria-label]="t.title">
            @for (assignment of assignments(); track assignment.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i
                    [class]="assignment.boardId === null ? 'pi pi-pen-to-square' : 'pi pi-th-large'"
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
                    icon="pi pi-ellipsis-v"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [pTooltip]="t.actions(assignment.title)"
                    [ariaLabel]="t.actions(assignment.title)"
                    [tbAttributes]="{
                      'aria-haspopup': 'menu',
                      'aria-expanded': menuFor()?.id === assignment.id ? 'true' : 'false',
                    }"
                    (onClick)="openMenu(assignment, $event)"
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

    <p-menu
      #menu
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      (onHide)="menuFor.set(null)"
    />
  `,
})
export class AssignmentsPage implements OnInit {
  protected readonly t = T.list;
  private readonly api = inject(HomeworkApi);
  private readonly router = inject(Router);
  private readonly dates = new DatePipe(inject(LOCALE_ID));
  private readonly menu = viewChild.required<Menu>('menu');

  protected readonly assignments = signal<AssignmentSummary[]>([]);
  protected readonly state = new LoadState();
  protected readonly toReview = computed(() =>
    this.assignments().reduce((sum, assignment) => sum + assignment.submitted, 0),
  );
  /** The assignment whose «⋮» menu is open: one popup menu serves every card. */
  protected readonly menuFor = signal<AssignmentSummary | null>(null);
  protected readonly menuItems = computed<MenuItem[]>(() => {
    const assignment = this.menuFor();
    return assignment === null ? [] : this.actionsOf(assignment);
  });
  protected readonly progress = assignmentProgress;
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

  protected openMenu(assignment: AssignmentSummary, event: Event): void {
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
              icon: 'pi pi-th-large',
              command: () => void this.router.navigate(['/teacher/boards', assignment.boardId]),
            },
          ]),
    ];
  }
}
