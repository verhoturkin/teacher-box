import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ListRow } from '@shared/ui/list-row';
import { Card } from 'primeng/card';
import { locale } from '@core/i18n/language';
import { BoardLinks } from '@features/boards/parts';
import { JoinLessonButton } from '@features/meetings/parts';
import { STATUS_LABELS, injectLessonClock, lessonWith } from '@features/schedule/parts';
import type { LessonTime, ScheduledLesson } from '@features/schedule/parts';
import { Avatar } from '@shared/ui/avatar';
import { T } from './i18n/texts';

const TIME = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });

/**
 * Spec «Today»: «Занятия сегодня» — one line per lesson (time, avatar, name, status); the current or
 * nearest one is the expanded row: its state, the end, who and the topic, the last board, the join
 * button. A nearest lesson of another day follows today's rows; with none today the card is
 * «Ближайшее занятие».
 */
@Component({
  selector: 'tb-today-lessons',
  imports: [ListRow, Card, Avatar, BoardLinks, JoinLessonButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="all().length > 0 ? t.title : t.nearest">
      <ul class="tb-list">
        @for (lesson of lessons(); track lesson.id) {
          @if (lesson.id === nextId() && clock(); as time) {
            <li tbListRow class="tb-today-lesson tb-today-lesson--next">
              <div class="tb-today-lesson__head">
                <time class="tb-today-lesson__time" [attr.datetime]="lesson.startsAt">{{
                  time.start
                }}</time>
                <span class="tb-today-lesson__state">
                  @if (time.phase === 'live') {
                    <span class="tb-today-lesson__dot" aria-hidden="true"></span>
                  }
                  {{ state(time) }}
                </span>
                <span class="tb-today-lesson__end">{{ t.until(clockTime(lesson.endsAt)) }}</span>
              </div>
              <div class="tb-today-lesson__who">
                <tb-avatar [name]="with(lesson)" [photo]="lesson.studentAvatar" />
                <div class="tb-list__text">
                  <strong>{{ with(lesson) }}</strong>
                  @if (lesson.title !== null) {
                    <span class="tb-list__supporting">{{ lesson.title }}</span>
                  }
                  @if (lesson.topic !== null) {
                    <span class="tb-list__supporting">{{ lesson.topic }}</span>
                  }
                </div>
              </div>
              <tb-board-links
                [chips]="true"
                [latest]="true"
                [studentId]="lesson.groupId === null ? lesson.studentId : null"
                [groupId]="lesson.groupId"
              />
              @if (lesson.joinUrl; as url) {
                <tb-join-lesson-button
                  class="tb-join-wide tb-today-lesson__join"
                  [url]="url"
                  [label]="time.phase === 'live' ? t.join : t.start"
                  [teacher]="true"
                />
              }
            </li>
          } @else {
            <li tbListRow class="tb-today-lesson">
              <time class="tb-today-lesson__time" [attr.datetime]="lesson.startsAt">{{
                clockTime(lesson.startsAt)
              }}</time>
              <tb-avatar [name]="with(lesson)" [photo]="lesson.studentAvatar" />
              <span class="tb-list__title">{{ with(lesson) }}</span>
              @if (lesson.status !== 'SCHEDULED') {
                <span class="tb-today-lesson__status tb-today-lesson__status--{{ lesson.status }}">
                  @if (lesson.status === 'CONDUCTED') {
                    <i class="tb-i tb-i-check" aria-hidden="true"></i>
                  }
                  {{ status(lesson).label }}
                </span>
              }
            </li>
          }
        }
      </ul>
    </p-card>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }

    .tb-today-lesson {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      padding: var(--tb-space-2) var(--tb-space-4);
    }

    .tb-list__title,
    .tb-list__text {
      flex: 1;
      min-width: 0;
    }

    /* the outcome as a tonal chip (ours: scheduled lessons say nothing, the sketch) */
    .tb-today-lesson__status {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
      padding: 0 var(--tb-space-2);
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-surface-container-highest);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      line-height: 1.5rem;
    }

    .tb-today-lesson__status--CONDUCTED {
      background: var(--p-md-success-container);
      color: var(--p-md-on-success-container);
    }

    .tb-today-lesson__status--MISSED {
      background: var(--p-md-warning-container);
      color: var(--p-md-on-warning-container);
    }

    .tb-today-lesson__status .tb-i {
      font-size: 1rem;
    }

    .tb-today-lesson__time {
      font: var(--tb-type-label-l);
      min-width: 3rem;
      font-variant-numeric: tabular-nums;
    }

    /* the expanded row (sketch «Сегодня — один урок»): head, who, the board, the join button */
    .tb-today-lesson--next {
      display: grid;
      /* not the list's lead / text / trail areas */
      grid-template-areas: none;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-3);
      align-items: center;
      padding: var(--tb-space-3);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      overflow-wrap: anywhere;
    }

    .tb-today-lesson--next tb-avatar {
      background: var(--p-md-surface);
    }

    .tb-today-lesson--next tb-board-links:empty {
      display: none;
    }

    .tb-today-lesson__head,
    .tb-today-lesson__who {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      min-width: 0;
    }

    .tb-today-lesson__state {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
      font: var(--tb-type-label-m-emphasized);
    }

    .tb-today-lesson__dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--p-md-error);
    }

    .tb-today-lesson__end {
      font: var(--tb-type-body-s);
    }

    /* wider than a phone (board 4): the join button ends the head line */
    @container (min-width: 30.0625rem) {
      .tb-today-lesson--next {
        grid-template-columns: minmax(0, 1fr) auto;

        > * {
          grid-column: 1;
        }

        > .tb-today-lesson__join {
          grid-column: 2;
          grid-row: 1;
        }
      }
    }
  `,
})
export class TodayLessons {
  protected readonly t = T.todayLessons;
  /** Lessons of today, cancelled ones included. */
  readonly all = input.required<readonly ScheduledLesson[]>();
  /** The nearest lesson that has not ended (it may be on another day): the expanded row. */
  readonly next = input<ScheduledLesson | null>(null);
  /** The expanded lesson is over: the home page loads the next one. */
  readonly over = output();

  private readonly nextToday = computed(() =>
    this.all().some((lesson) => lesson.id === this.next()?.id),
  );
  protected readonly lessons = computed(() => {
    const next = this.next();
    const today = [...this.all()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return next === null || this.nextToday() ? today : [...today, next];
  });
  protected readonly nextId = computed(() => this.next()?.id ?? null);
  protected readonly clock = injectLessonClock(this.next, () => {
    this.over.emit();
  });
  protected readonly with = lessonWith;

  protected clockTime(moment: string): string {
    return TIME.format(new Date(moment));
  }

  /** «Идёт · ещё 25 мин»; today «Через 40 мин» (beyond the hour the duration); else «Завтра». */
  protected state(time: LessonTime): string {
    switch (time.phase) {
      case 'live':
        return this.t.live(time.note);
      case 'over':
        return '';
      default:
        return this.nextToday() ? time.note.charAt(0).toUpperCase() + time.note.slice(1) : time.day;
    }
  }

  protected status(lesson: ScheduledLesson): (typeof STATUS_LABELS)[keyof typeof STATUS_LABELS] {
    return STATUS_LABELS[lesson.status];
  }
}
