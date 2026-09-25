import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Badge } from 'primeng/badge';
import { Button, ButtonDirective, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { IdentityApi } from '@features/identity';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { AssignmentDetails, AssignmentSummary } from '../data-access/homework.models';
import { AssignmentDialog, StudentOption } from './assignment-dialog';

/** Teacher: all assignments with progress. */
@Component({
  selector: 'tb-assignments-page',
  imports: [DatePipe, RouterLink, Badge, Button, ButtonDirective, ButtonLabel, Card, TableModule, RowType, AssignmentDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-page-header">
      <h1 class="tb-page-title">Домашние задания</h1>
      <div class="tb-actions">
        <a pButton routerLink="review" [outlined]="true">
          <span pButtonLabel>На проверку</span>
          @if (toReview() > 0) {
            <p-badge [value]="toReview()" severity="warn" />
          }
        </a>
        <p-button label="Новое задание" icon="pi pi-plus" (onClick)="openCreate()" />
      </div>
    </div>

    <p-card>
      <p-table [value]="assignments()" dataKey="id" [rowHover]="true" [loading]="loading()">
        <ng-template #header>
          <tr>
            <th>Задание</th>
            <th>Срок</th>
            <th>Учеников</th>
            <th>На проверке</th>
            <th>Принято</th>
          </tr>
        </ng-template>
        <ng-template #body let-row [tbRowType]="assignments()">
          <tr>
            <td><a [routerLink]="[row.id]" class="tb-link">{{ row.title }}</a></td>
            <td>{{ row.dueAt ? (row.dueAt | date: 'dd.MM.yyyy HH:mm') : 'без срока' }}</td>
            <td>{{ row.totalTasks }}</td>
            <td [class.tb-strong]="row.submitted > 0">{{ row.submitted }}</td>
            <td>{{ row.accepted }} из {{ row.totalTasks }}</td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="5" class="tb-empty">Заданий пока нет. Создайте первое!</td></tr>
        </ng-template>
      </p-table>
    </p-card>

    <tb-assignment-dialog [(visible)]="dialogVisible" [students]="students()" (saved)="onCreated($event)" />
  `,
})
export class AssignmentsPage implements OnInit {
  private readonly api = inject(HomeworkApi);
  private readonly identity = inject(IdentityApi);
  private readonly router = inject(Router);

  protected readonly assignments = signal<AssignmentSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly toReview = computed(() =>
    this.assignments().reduce((sum, assignment) => sum + assignment.submitted, 0),
  );
  protected readonly students = signal<StudentOption[]>([]);
  protected readonly dialogVisible = signal(false);

  ngOnInit(): void {
    this.api.assignments().subscribe({
      next: (assignments) => {
        this.assignments.set(assignments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
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
