import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { MyHomeworkSummary } from '../data-access/homework.models';
import { EmptyState } from '@shared/ui/empty-state';

/** Student's home: open tasks, the nearest deadline first. */
@Component({
  selector: 'tb-my-deadlines-widget',
  imports: [EmptyState, DatePipe, RouterLink, Card, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let homework = summary();
    <p-card header="Домашние задания">
      @if (homework.upcoming.length === 0) {
        <tb-empty-state [compact]="true" icon="pi-book" title="Открытых заданий нет" />
      } @else {
        <ul class="tb-list tb-deadlines">
          @for (task of homework.upcoming; track task.taskId) {
            <li>
              <span
                class="tb-list__lead"
                [class.tb-list__lead--accent]="task.overdue"
                aria-hidden="true"
                ><i class="pi pi-book"></i
              ></span>
              <div class="tb-list__text">
                <a
                  [routerLink]="['/cabinet/homework', task.taskId]"
                  class="tb-list__title tb-link"
                  >{{ task.title }}</a
                >
                <span class="tb-list__supporting">
                  @if (task.dueAt !== null) {
                    до {{ task.dueAt | date: 'dd.MM.yyyy HH:mm' }}
                  } @else {
                    без срока
                  }
                </span>
              </div>
              @if (task.overdue) {
                <div class="tb-list__trail"><p-tag value="Просрочено" severity="danger" /></div>
              } @else if (task.status === 'RETURNED') {
                <div class="tb-list__trail"><p-tag value="На доработку" severity="danger" /></div>
              }
            </li>
          }
        </ul>
      }
      <div class="tb-widget-footer">
        <span class="tb-muted">Открыто: {{ homework.open }}{{ overdueText() }}</span>
        <a routerLink="/cabinet/homework">Все задания</a>
      </div>
    </p-card>
  `,
})
export class MyDeadlinesWidget {
  readonly summary = input.required<MyHomeworkSummary>();

  protected readonly overdueText = computed(() => {
    const overdue = this.summary().overdue;
    return overdue > 0 ? `, просрочено: ${String(overdue)}` : '';
  });
}
