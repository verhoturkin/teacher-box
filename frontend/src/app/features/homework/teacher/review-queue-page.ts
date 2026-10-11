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
import { Avatar } from '@shared/ui/avatar';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** Teacher: submitted tasks waiting for review, oldest first. */
@Component({
  selector: 'tb-review-queue-page',
  imports: [
    Avatar,
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
    <tb-page-header [title]="t.title" back="/teacher/homework" [backLabel]="t.back">
      <tb-help-button help topic="teacher/homework" />
    </tb-page-header>
    <p-card>
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        <p-table [value]="items()" dataKey="taskId" [rowHover]="true" styleClass="tb-cards">
          <ng-template #header>
            <tr>
              <th class="tb-col-main">{{ t.student }}</th>
              <th>{{ t.assignment }}</th>
              <th>{{ t.submitted }}</th>
              <th>{{ t.due }}</th>
              <th class="tb-actions-column">
                <span class="tb-sr-only">{{ c.actions }}</span>
              </th>
            </tr>
          </ng-template>
          <ng-template #body let-item [tbRowType]="items()">
            <tr>
              <td [attr.data-label]="t.student">
                <div class="tb-person">
                  <tb-avatar [name]="item.studentName" [photo]="item.studentAvatar" />
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ item.studentName }}</span>
                  </div>
                </div>
              </td>
              <td [attr.data-label]="t.assignment">{{ item.title }}</td>
              <td [attr.data-label]="t.submitted">
                {{ item.submittedAt ? (item.submittedAt | date: 'dd.MM.yyyy HH:mm') : '—' }}
              </td>
              <td [attr.data-label]="t.due">
                {{ item.dueAt ? (item.dueAt | date: 'dd.MM.yyyy HH:mm') : '—' }}
              </td>
              <td class="tb-actions-column">
                <a
                  pButton
                  [routerLink]="['/teacher/homework/tasks', item.taskId]"
                  [text]="true"
                  [attr.aria-label]="t.reviewOf(item.studentName, item.title)"
                >
                  <span pButtonLabel>{{ t.review }}</span>
                </a>
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="5">
                <tb-empty-state
                  icon="pi-check-circle"
                  [title]="t.emptyTitle"
                  [hint]="t.emptyHint"
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
  protected readonly c = SHARED_T.common;
  protected readonly t = T.queue;
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
