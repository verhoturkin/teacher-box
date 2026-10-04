import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { JoinLessonButton } from '@features/meetings/parts';
import { ScheduleApi } from '../data-access/schedule-api';
import { LessonOutcome, ScheduleSummary, ScheduledLesson } from '../data-access/schedule.models';
import { STATUS_LABELS, formatClockRange, lessonWith } from '../schedule-labels';
import { InitialsPipe } from '@shared/ui/initials';
import { AttendanceDialog } from '../teacher/attendance-dialog';

/** Teacher's home: today's lessons with a link to the lesson and quick marks (attendance of a group). */
@Component({
  selector: 'tb-today-lessons-widget',
  imports: [
    RouterLink,
    Button,
    Card,
    Tag,
    AttendanceDialog,
    InitialsPipe,
    JoinLessonButton,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Сегодня">
      @let lessons = summary().today;
      @if (lessons.length === 0) {
        <p class="tb-muted">Сегодня занятий нет.</p>
      } @else {
        <ul class="tb-list tb-today">
          @for (lesson of lessons; track lesson.id) {
            <li
              class="tb-today__lesson"
              [class.tb-today__lesson--cancelled]="lesson.status === 'CANCELLED'"
            >
              <span class="tb-avatar" aria-hidden="true">{{ with(lesson) | initials }}</span>
              <div class="tb-list__text tb-today__info">
                <span class="tb-list__title">{{ with(lesson) }}</span>
                <span class="tb-list__supporting">
                  <span class="tb-today__time">{{ time(lesson) }}</span>
                  @if (lesson.groupId !== null) {
                    · учеников: {{ lesson.participants.length }}
                  }
                  @if (lesson.topic !== null) {
                    · {{ lesson.topic }}
                  }
                </span>
              </div>
              <div class="tb-list__trail">
                @if (lesson.status !== 'SCHEDULED') {
                  <p-tag
                    [value]="statuses[lesson.status].label"
                    [severity]="statuses[lesson.status].severity"
                  />
                } @else {
                  @if (lesson.joinUrl; as url) {
                    <tb-join-lesson-button
                      [url]="url"
                      label="Начать урок"
                      [teacher]="true"
                      [tonal]="true"
                    />
                  }
                  @if (started(lesson) && lesson.groupId !== null) {
                    <p-button
                      label="Отметить"
                      icon="pi pi-users"
                      severity="success"
                      [text]="true"
                      [ariaLabel]="'Отметить посещаемость: ' + with(lesson)"
                      (onClick)="openAttendance(lesson)"
                    />
                  } @else if (started(lesson)) {
                    <p-button
                      icon="pi pi-check"
                      severity="success"
                      [text]="true"
                      [pTooltip]="'Проведено: ' + (lesson.studentName ?? '')"
                      [rounded]="true"
                      [ariaLabel]="'Проведено: ' + (lesson.studentName ?? '')"
                      [disabled]="pending() === lesson.id"
                      (onClick)="mark(lesson, 'CONDUCTED')"
                    />
                    <p-button
                      icon="pi pi-user-minus"
                      severity="danger"
                      [text]="true"
                      [pTooltip]="'Пропуск: ' + (lesson.studentName ?? '')"
                      [rounded]="true"
                      [ariaLabel]="'Пропуск: ' + (lesson.studentName ?? '')"
                      [disabled]="pending() === lesson.id"
                      (onClick)="mark(lesson, 'MISSED')"
                    />
                  }
                }
              </div>
            </li>
          }
        </ul>
      }
      <div class="tb-widget-footer">
        <span class="tb-muted">Впереди на неделе: {{ summary().weekLessons }}</span>
        <a routerLink="/teacher/schedule">Расписание</a>
      </div>
    </p-card>

    <tb-attendance-dialog
      [(visible)]="attendanceVisible"
      [lesson]="attendanceLesson()"
      (saved)="changed.emit()"
    />
  `,
  styles: `
    .tb-today__lesson--cancelled .tb-today__info {
      color: var(--p-md-on-surface-variant);
      text-decoration: line-through;
    }

    .tb-today__time {
      font-variant-numeric: tabular-nums;
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
  protected readonly with = lessonWith;
  protected readonly attendanceVisible = signal(false);
  protected readonly attendanceLesson = signal<ScheduledLesson | null>(null);

  protected time(lesson: ScheduledLesson): string {
    return formatClockRange(lesson.startsAt, lesson.endsAt);
  }

  protected started(lesson: ScheduledLesson): boolean {
    return new Date(lesson.startsAt).getTime() <= this.now().getTime();
  }

  openAttendance(lesson: ScheduledLesson): void {
    this.attendanceLesson.set(lesson);
    this.attendanceVisible.set(true);
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
