import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Card } from 'primeng/card';
import { BoardLinks } from '@features/boards/parts';
import { JoinLessonButton } from '@features/meetings/parts';
import { Avatar } from '@shared/ui/avatar';
import { ScheduledLesson } from '../data-access/schedule.models';
import { lessonWith } from '../schedule-labels';
import { LessonTimeTile } from '../ui/lesson-time-tile';
import { injectLessonClock } from './lesson-clock';
import { T } from '../i18n/texts';

/**
 * Teacher's home, on top: the nearest lesson as a calendar event — the time tile, who and the topic,
 * the boards of the student or group, «Начать урок» («Войти в урок» while it runs). The tile says what
 * it is, so the title «Следующее занятие» is for screen readers only.
 */
@Component({
  selector: 'tb-upcoming-lesson-widget',
  imports: [Card, Avatar, JoinLessonButton, BoardLinks, LessonTimeTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card styleClass="tb-hero">
      <h2 class="tb-sr-only">{{ t.title }}</h2>
      @let next = lesson();
      <div class="tb-lesson-event">
        @if (time(); as time) {
          <tb-lesson-time-tile [time]="time" />
        }
        <div class="tb-lesson-event__info">
          <div class="tb-lesson-event__who">
            <tb-avatar [name]="with(next)" [photo]="next.studentAvatar" size="2rem" />
            <strong>{{ with(next) }}</strong>
          </div>
          @if (next.title !== null) {
            <span class="tb-muted">{{ next.title }}</span>
          }
          @if (next.topic !== null) {
            <span class="tb-muted">{{ next.topic }}</span>
          }
          <tb-board-links
            [chips]="true"
            [studentId]="next.groupId === null ? next.studentId : null"
            [groupId]="next.groupId"
          />
        </div>
        @if (next.joinUrl; as url) {
          <div class="tb-lesson-event__actions">
            <tb-join-lesson-button
              class="tb-join-wide"
              [url]="url"
              [label]="joinLabel()"
              [teacher]="true"
              [medium]="true"
            />
          </div>
        }
      </div>
    </p-card>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }

    .tb-lesson-event {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--tb-space-4);
    }

    /* one column: the avatar with the name, the topic, the boards — all from one left edge */
    .tb-lesson-event__info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--tb-space-1);
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .tb-lesson-event__who {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      min-width: 0;
    }

    tb-board-links:not(:empty) {
      margin-top: var(--tb-space-1);
    }

    tb-lesson-time-tile {
      align-self: stretch;
    }

    /* a phone: the button goes under the tile and the text, across the width */
    @container (max-width: 30rem) {
      .tb-lesson-event {
        gap: var(--tb-space-3);
      }

      .tb-lesson-event__actions {
        grid-column: 1 / -1;
      }

      tb-lesson-time-tile {
        min-width: 6.5rem;
        padding-inline: var(--tb-space-2);
      }
    }
  `,
})
export class UpcomingLessonWidget {
  protected readonly t = T.upcoming;
  readonly lesson = input.required<ScheduledLesson>();
  /** The lesson is over: the home page loads the next one. */
  readonly over = output();

  protected readonly with = lessonWith;
  protected readonly time = injectLessonClock(this.lesson, () => {
    this.over.emit();
  });
  protected readonly joinLabel = computed(() =>
    this.time()?.phase === 'live' ? T.upcoming.join : T.upcoming.start,
  );
}
