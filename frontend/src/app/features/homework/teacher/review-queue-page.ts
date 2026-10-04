import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonLabel } from 'primeng/button';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { RowType } from '@shared/ui/row-type.directive';
import { HomeworkApi } from '../data-access/homework-api';
import { ReviewQueueItem } from '../data-access/homework.models';
import { EmptyState } from '@shared/ui/empty-state';
import { PageHeader } from '@shared/ui/page-header';
import { HelpButton } from '@features/help/parts';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';

/** Teacher: submitted tasks waiting for review, oldest first. */
@Component({
  selector: 'tb-review-queue-page',
  imports: [
    EmptyState,
    DatePipe,
    RouterLink,
    ButtonDirective,
    ButtonLabel,
    Card,
    TableModule,
    RowType,
    PageHeader,
    HelpButton,
    LoadStateView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="На проверку" back="/teacher/homework" backLabel="Задания">
      <tb-help-button help topic="teacher/homework" />
    </tb-page-header>
    <p-card>
      <tb-load-state [state]="state" what="работы на проверку" (retry)="load()">
        <p-table [value]="items()" dataKey="taskId" [rowHover]="true" styleClass="tb-cards">
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
              <td data-label="Ученик">{{ item.studentName }}</td>
              <td data-label="Задание">{{ item.title }}</td>
              <td data-label="Сдано">
                {{ item.submittedAt ? (item.submittedAt | date: 'dd.MM.yyyy HH:mm') : '—' }}
              </td>
              <td data-label="Срок">
                {{ item.dueAt ? (item.dueAt | date: 'dd.MM.yyyy HH:mm') : '—' }}
              </td>
              <td class="tb-actions-column">
                <a
                  pButton
                  [routerLink]="['/teacher/homework/tasks', item.taskId]"
                  [text]="true"
                  [attr.aria-label]="'Проверить: ' + item.studentName + ', ' + item.title"
                >
                  <span pButtonLabel>Проверить</span>
                </a>
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="5">
                <tb-empty-state
                  icon="pi-check-circle"
                  title="Всё проверено"
                  hint="Новые ответы учеников появятся здесь"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </tb-load-state>
    </p-card>
  `,
})
export class ReviewQueuePage implements OnInit {
  private readonly api = inject(HomeworkApi);

  protected readonly items = signal<ReviewQueueItem[]>([]);
  protected readonly state = new LoadState();

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.api
      .reviewQueue()
      .pipe(this.state.track())
      .subscribe((items) => {
        this.items.set(items);
      });
  }
}
