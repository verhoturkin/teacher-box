import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { ScheduleApi } from '../data-access/schedule-api';
import { LessonOutcome, ScheduleSummary, ScheduledLesson } from '../data-access/schedule.models';
import { STATUS_LABELS, formatClockRange } from '../schedule-labels';

/** Teacher's home: today's lessons with a link to the lesson and quick marks. */
@Component({
  selector: 'tb-today-lessons-widget',
  imports: [RouterLink, Button, Card, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Сегодня">
      @let lessons = summary().today;
      @if (lessons.length === 0) {
        <p class="tb-muted">Сегодня занятий нет.</p>
      } @else {
        <ul class="tb-today">
          @for (lesson of lessons; track lesson.id) {
            <li class="tb-today__lesson" [class.tb-today__lesson--cancelled]="lesson.status === 'CANCELLED'">
              <span class="tb-today__time">{{ time(lesson) }}</span>
              <div class="tb-today__info">
                <strong>{{ lesson.studentName ?? 'Ученик' }}</strong>
                @if (lesson.topic !== null) {
                  <small class="tb-muted">{{ lesson.topic }}</small>
                }
              </div>
              @if (lesson.status !== 'SCHEDULED') {
                <p-tag [value]="statuses[lesson.status].label" [severity]="statuses[lesson.status].severity" />
              } @else {
                @if (lesson.meetingUrl !== null) {
                  <a class="p-button p-button-sm p-button-outlined tb-today__join" [href]="lesson.meetingUrl" target="_blank" rel="noopener">
                    <i class="pi pi-video" aria-hidden="true"></i>
                    <span>Урок</span>
                  </a>
                }
                @if (started(lesson)) {
                  <p-button
                    icon="pi pi-check"
                    size="small"
                    severity="success"
                    [text]="true"
                    [ariaLabel]="'Проведено: ' + (lesson.studentName ?? '')"
                    [disabled]="pending() === lesson.id"
                    (onClick)="mark(lesson, 'CONDUCTED')"
                  />
                  <p-button
                    icon="pi pi-user-minus"
                    size="small"
                    severity="warn"
                    [text]="true"
                    [ariaLabel]="'Пропуск: ' + (lesson.studentName ?? '')"
                    [disabled]="pending() === lesson.id"
                    (onClick)="mark(lesson, 'MISSED')"
                  />
                }
              }
            </li>
          }
        </ul>
      }
      <div class="tb-widget-footer">
        <span class="tb-muted">Впереди на неделе: {{ summary().weekLessons }}</span>
        <a routerLink="/teacher/schedule">Расписание</a>
      </div>
    </p-card>
  `,
  styles: `
    .tb-today {
      display: flex;
      flex-direction: column;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tb-today__lesson {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--p-content-border-color);
    }

    .tb-today__lesson--cancelled .tb-today__info {
      text-decoration: line-through;
      opacity: 0.7;
    }

    .tb-today__time {
      min-width: 7.5rem;
      font-variant-numeric: tabular-nums;
    }

    .tb-today__info {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 8rem;
    }

    .tb-today__join {
      display: inline-flex;
      gap: 0.5rem;
      text-decoration: none;
    }
  `,
})
export class TodayLessonsWidget {
  private readonly api = inject(ScheduleApi);

  readonly summary = input.required<ScheduleSummary>();
  /** The moment the page treats as «now» (tests pass a fixed one). */
  readonly now = input<Date>(new Date());
  /** A lesson was marked. */
  readonly changed = output();

  protected readonly statuses = STATUS_LABELS;
  protected readonly pending = signal<string | null>(null);

  protected time(lesson: ScheduledLesson): string {
    return formatClockRange(lesson.startsAt, lesson.endsAt);
  }

  protected started(lesson: ScheduledLesson): boolean {
    return new Date(lesson.startsAt).getTime() <= this.now().getTime();
  }

  mark(lesson: ScheduledLesson, outcome: LessonOutcome): void {
    this.pending.set(lesson.id);
    this.api.setOutcome(lesson.id, outcome).subscribe({
      next: () => {
        this.pending.set(null);
        this.changed.emit();
      },
      error: () => {
        this.pending.set(null);
      },
    });
  }
}
