import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { MyHomeworkSummary } from '../data-access/homework.models';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from '../i18n/texts';

/** Student's home: open tasks, the nearest deadline first. */
@Component({
  selector: 'tb-my-deadlines-widget',
  imports: [EmptyState, DatePipe, RouterLink, Card, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let homework = summary();
    <p-card [header]="t.title">
      @if (homework.upcoming.length === 0) {
        <tb-empty-state [compact]="true" icon="tb-i-assignment" [title]="t.nothing" />
      } @else {
        <ul class="tb-list tb-list--no-phone-lead tb-deadlines">
          @for (task of homework.upcoming; track task.taskId) {
            <li>
              <span
                class="tb-list__lead"
                [class.tb-list__lead--accent]="task.overdue"
                aria-hidden="true"
                ><i class="tb-i tb-i-assignment"></i
              ></span>
              <div class="tb-list__text">
                <a
                  [routerLink]="['/cabinet/homework', task.taskId]"
                  class="tb-list__title tb-link"
                  >{{ task.title }}</a
                >
                <span class="tb-list__supporting">
                  @if (task.dueAt !== null) {
                    {{ t.until((task.dueAt | date: 'dd.MM.yyyy HH:mm') ?? '') }}
                  } @else {
                    {{ noDueDate }}
                  }
                </span>
              </div>
              @if (task.overdue) {
                <div class="tb-list__trail"><p-tag [value]="overdueLabel" severity="danger" /></div>
              } @else if (task.status === 'RETURNED') {
                <div class="tb-list__trail"><p-tag [value]="t.toRework" severity="danger" /></div>
              }
            </li>
          }
        </ul>
      }
      <div class="tb-widget-footer">
        <span class="tb-muted">{{ t.open(homework.open) }}{{ overdueText() }}</span>
        <a routerLink="/cabinet/homework">{{ t.all }}</a>
      </div>
    </p-card>
  `,
})
export class MyDeadlinesWidget {
  protected readonly overdueLabel = T.overdue;
  protected readonly noDueDate = T.noDueDate;
  protected readonly t = T.deadlines;
  readonly summary = input.required<MyHomeworkSummary>();

  protected readonly overdueText = computed(() => {
    const overdue = this.summary().overdue;
    return overdue > 0 ? T.deadlines.overdue(overdue) : '';
  });
}
