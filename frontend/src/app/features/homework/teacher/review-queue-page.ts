import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { ReviewQueueItem } from '../data-access/homework.models';

/** Teacher: submitted tasks waiting for review, oldest first. */
@Component({
  selector: 'tb-review-queue-page',
  imports: [DatePipe, RouterLink, ButtonDirective, ButtonIcon, ButtonLabel, Card, TableModule, RowType],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a pButton routerLink="/teacher/homework" [text]="true" class="tb-back">
      <i pButtonIcon class="pi pi-arrow-left"></i>
      <span pButtonLabel>Все задания</span>
    </a>
    <h1 class="tb-page-title">На проверку</h1>
    <p-card>
      <p-table [value]="items()" dataKey="taskId" [rowHover]="true" [loading]="loading()">
        <ng-template #header>
          <tr>
            <th>Ученик</th>
            <th>Задание</th>
            <th>Сдано</th>
            <th>Срок</th>
            <th class="tb-actions-column"><span class="tb-sr-only">Действия</span></th>
          </tr>
        </ng-template>
        <ng-template #body let-item [tbRowType]="items()">
          <tr>
            <td>{{ item.studentName }}</td>
            <td>{{ item.title }}</td>
            <td>{{ item.submittedAt ? (item.submittedAt | date: 'dd.MM.yyyy HH:mm') : '—' }}</td>
            <td>{{ item.dueAt ? (item.dueAt | date: 'dd.MM.yyyy HH:mm') : '—' }}</td>
            <td class="tb-actions-column">
              <a pButton [routerLink]="['/teacher/homework/tasks', item.taskId]" size="small">
                <span pButtonLabel>Проверить</span>
              </a>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr><td colspan="5" class="tb-empty">Всё проверено</td></tr>
        </ng-template>
      </p-table>
    </p-card>
  `,
})
export class ReviewQueuePage implements OnInit {
  private readonly api = inject(HomeworkApi);

  protected readonly items = signal<ReviewQueueItem[]>([]);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    this.api.reviewQueue().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
