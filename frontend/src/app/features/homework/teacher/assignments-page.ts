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
import { Router, RouterLink } from '@angular/router';
import { Badge } from 'primeng/badge';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { HelpButton } from '@features/help/parts';
import { IdentityApi } from '@features/identity/parts';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, AssignmentSummary } from '../data-access/homework.models';
import { AssignmentDialog, StudentOption } from './assignment-dialog';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';

/** Teacher: all assignments with progress. */
@Component({
  selector: 'tb-assignments-page',
  imports: [
    EmptyState,
    HelpButton,
    DatePipe,
    RouterLink,
    Badge,
    Button,
    ButtonDirective,
    ButtonLabel,
    Card,
    TableModule,
    RowType,
    AssignmentDialog,
    PageHeader,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Задания">
      <tb-help-button help topic="teacher/homework" />
      <a pButton routerLink="review" severity="secondary">
        <span pButtonLabel>На проверку</span>
        @if (toReview() > 0) {
          <p-badge [value]="toReview()" severity="warn" />
        }
      </a>
      <p-button
        class="tb-page-fab"
        label="Новое задание"
        icon="pi pi-plus"
        (onClick)="openCreate()"
      />
    </tb-page-header>

    <p-card>
      <tb-load-state [state]="state" what="задания" (retry)="load()">
        <p-table [value]="assignments()" dataKey="id" [rowHover]="true" styleClass="tb-cards">
          <ng-template #header>
            <tr>
              <th class="tb-col-main">Задание</th>
              <th>Срок</th>
              <th>Учеников</th>
              <th>На проверке</th>
              <th>Принято</th>
            </tr>
          </ng-template>
          <ng-template #body let-row [tbRowType]="assignments()">
            <tr>
              <td data-label="Задание">
                <a [routerLink]="[row.id]" class="tb-link">{{ row.title }}</a>
              </td>
              <td data-label="Срок">
                {{ row.dueAt ? (row.dueAt | date: 'dd.MM.yyyy HH:mm') : 'без срока' }}
              </td>
              <td data-label="Учеников">{{ row.totalTasks }}</td>
              <td data-label="На проверке" [class.tb-strong]="row.submitted > 0">
                {{ row.submitted }}
              </td>
              <td data-label="Принято">{{ row.accepted }} из {{ row.totalTasks }}</td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="5">
                <tb-empty-state
                  icon="pi-book"
                  title="Заданий пока нет"
                  hint="Нажмите «Новое задание» и выдайте его ученикам"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </tb-load-state>
    </p-card>

    <tb-assignment-dialog
      [(visible)]="dialogVisible"
      [students]="students()"
      (saved)="onCreated($event)"
    />
  `,
})
export class AssignmentsPage implements OnInit {
  private readonly api = inject(HomeworkApi);
  private readonly identity = inject(IdentityApi);
  private readonly router = inject(Router);

  protected readonly assignments = signal<AssignmentSummary[]>([]);
  protected readonly state = new LoadState();
  protected readonly toReview = computed(() =>
    this.assignments().reduce((sum, assignment) => sum + assignment.submitted, 0),
  );
  protected readonly students = signal<StudentOption[]>([]);
  protected readonly dialogVisible = signal(false);
  /** `?create=...` from the quick actions of the home page: opens the form at once. */
  readonly create = input<string>();

  ngOnInit(): void {
    if (this.create() === 'assignment') {
      this.openCreate();
    }
    this.load();
  }

  protected load(): void {
    this.api
      .assignments()
      .pipe(this.state.track())
      .subscribe((assignments) => {
        this.assignments.set(assignments);
      });
  }

  protected openCreate(): void {
    this.identity.listStudents().subscribe((students) => {
      this.students.set(
        students
          .filter((student) => student.status !== 'DEACTIVATED')
          .map((student) => ({ id: student.id, displayName: student.displayName })),
      );
      this.dialogVisible.set(true);
    });
  }

  protected onCreated(assignment: AssignmentDetails): void {
    void this.router.navigate(['/teacher/homework', assignment.id]);
  }
}
