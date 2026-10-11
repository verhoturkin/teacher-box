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
import { Avatar } from '@shared/ui/avatar';
import { AttendanceDialog } from '../teacher/attendance-dialog';
import { Snackbar } from '@core/snackbar/snackbar';
import { EmptyState } from '@shared/ui/empty-state';
import { T } from '../i18n/texts';

/** Teacher's home: today's lessons with a link to the lesson and quick marks (attendance of a group). */
@Component({
  selector: 'tb-today-lessons-widget',
  imports: [
    EmptyState,
    RouterLink,
    Button,
    Card,
    Tag,
    AttendanceDialog,
    Avatar,
    JoinLessonButton,
    Tooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      @let lessons = summary().today;
      @if (lessons.length === 0) {
        <tb-empty-state [compact]="true" icon="pi-calendar" [title]="t.nothing" />
      } @else {
        <ul class="tb-list tb-today">
          @for (lesson of lessons; track lesson.id) {
            <li
              class="tb-today__lesson"
              [class.tb-today__lesson--cancelled]="lesson.status === 'CANCELLED'"
            >
              <tb-avatar [name]="with(lesson)" [photo]="lesson.studentAvatar" />
              <div class="tb-list__text tb-today__info">
                <span class="tb-list__title">{{ with(lesson) }}</span>
                <span class="tb-list__supporting">
                  <span class="tb-today__time">{{ time(lesson) }}</span>
                  @if (lesson.groupId !== null) {
                    · {{ t.students(lesson.participants.length) }}
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
                      [label]="t.start"
                      [teacher]="true"
                      [tonal]="true"
                    />
                  }
                  @if (started(lesson) && lesson.groupId !== null) {
                    <p-button
                      [label]="t.mark"
                      icon="pi pi-users"
                      severity="success"
                      [text]="true"
                      [ariaLabel]="t.markAttendance(with(lesson))"
                      (onClick)="openAttendance(lesson)"
                    />
                  } @else if (started(lesson)) {
                    <p-button
                      icon="pi pi-check"
                      severity="success"
                      [text]="true"
                      [pTooltip]="t.conducted(lesson.studentName ?? '')"
                      [rounded]="true"
                      [ariaLabel]="t.conducted(lesson.studentName ?? '')"
                      [disabled]="pending() === lesson.id"
                      (onClick)="mark(lesson, 'CONDUCTED')"
                    />
                    <p-button
                      icon="pi pi-user-minus"
                      severity="danger"
                      [text]="true"
                      [pTooltip]="t.missed(lesson.studentName ?? '')"
                      [rounded]="true"
                      [ariaLabel]="t.missed(lesson.studentName ?? '')"
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
        <span class="tb-muted">{{ t.week(summary().weekLessons) }}</span>
        <a routerLink="/teacher/schedule">{{ t.schedule }}</a>
      </div>
    </p-card>

    <tb-attendance-dialog
      [(visible)]="attendanceVisible"
      [lesson]="attendanceLesson()"
      (saved)="done(t.attendanceSaved)"
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
  protected readonly t = T.today;
  private readonly snackbar = inject(Snackbar);
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

  protected done(message: string): void {
    this.snackbar.success(message);
    this.changed.emit();
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
        this.done(T.today.marked);
      },
      error: () => {
        this.pending.set(null);
      },
    });
  }
}
