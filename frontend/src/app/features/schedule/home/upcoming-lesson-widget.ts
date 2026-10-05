import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { BoardLinks } from '@features/boards/parts';
import { JoinLessonButton } from '@features/meetings/parts';
import { ScheduledLesson } from '../data-access/schedule.models';
import { formatLessonTime, lessonWith } from '../schedule-labels';

/** Teacher's home, on top: the nearest lesson with «Начать урок» and the boards of the student or group. */
@Component({
  selector: 'tb-upcoming-lesson-widget',
  imports: [RouterLink, Card, JoinLessonButton, BoardLinks],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Следующее занятие" styleClass="tb-upcoming tb-hero">
      @let next = lesson();
      <div class="tb-upcoming__body">
        <div class="tb-upcoming__info">
          <span class="tb-upcoming__time">{{ time() }}</span>
          <strong>{{ with(next) }}</strong>
          @if (next.topic !== null) {
            <span class="tb-muted">{{ next.topic }}</span>
          }
          <tb-board-links
            [studentId]="next.groupId === null ? next.studentId : null"
            [groupId]="next.groupId"
          />
        </div>
        <div class="tb-actions">
          @if (next.joinUrl; as url) {
            <tb-join-lesson-button [url]="url" label="Начать урок" [teacher]="true" />
          }
          <a routerLink="/teacher/schedule">Расписание</a>
        </div>
      </div>
    </p-card>
  `,
  styles: `
    .tb-upcoming__body {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-4);
    }

    .tb-upcoming__info {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
    }

    .tb-upcoming__time {
      font: var(--tb-type-headline-s);
    }

    .tb-actions {
      align-items: center;
      gap: var(--tb-space-4);
    }
  `,
})
export class UpcomingLessonWidget {
  readonly lesson = input.required<ScheduledLesson>();

  protected readonly with = lessonWith;
  protected readonly time = computed(() =>
    formatLessonTime(this.lesson().startsAt, this.lesson().endsAt),
  );
}
