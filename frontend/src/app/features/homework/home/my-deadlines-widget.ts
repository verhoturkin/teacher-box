import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { MyHomeworkSummary } from '../data-access/homework.models';

/** Student's home: open tasks, the nearest deadline first. */
@Component({
  selector: 'tb-my-deadlines-widget',
  imports: [DatePipe, RouterLink, Card, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let homework = summary();
    <p-card header="Домашние задания">
      @if (homework.upcoming.length === 0) {
        <p class="tb-muted">Открытых заданий нет.</p>
      } @else {
        <ul class="tb-deadlines">
          @for (task of homework.upcoming; track task.taskId) {
            <li>
              <a [routerLink]="['/cabinet/homework', task.taskId]" class="tb-link">{{ task.title }}</a>
              @if (task.overdue) {
                <p-tag value="Просрочено" severity="danger" />
              } @else if (task.status === 'RETURNED') {
                <p-tag value="На доработку" severity="warn" />
              }
              <small class="tb-muted">
                @if (task.dueAt !== null) {
                  до {{ task.dueAt | date: 'dd.MM, HH:mm' }}
                } @else {
                  без срока
                }
              </small>
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
  styles: `
    .tb-deadlines {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--p-content-border-color);
      }

      a {
        flex: 1;
        min-width: 10rem;
      }
    }
  `,
})
export class MyDeadlinesWidget {
  readonly summary = input.required<MyHomeworkSummary>();

  protected readonly overdueText = computed(() => {
    const overdue = this.summary().overdue;
    return overdue > 0 ? `, просрочено: ${String(overdue)}` : '';
  });
}
