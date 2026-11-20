import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ListRow } from '@shared/ui/list-row';
import { Card } from 'primeng/card';
import { locale } from '@core/i18n/language';
import { BoardLinks } from '@features/boards/parts';
import { CallSummon, JoinLessonButton } from '@features/meetings/parts';
import {
  LessonTimeTile,
  STATUS_LABELS,
  injectLessonClock,
  lessonWith,
} from '@features/schedule/parts';
import type { LessonTime, ScheduledLesson } from '@features/schedule/parts';
import { Avatar } from '@shared/ui/avatar';
import { WavyProgress } from '@shared/ui/wavy-progress';
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
  imports: [
    ListRow,
    Card,
    Avatar,
    BoardLinks,
    CallSummon,
    JoinLessonButton,
    LessonTimeTile,
    WavyProgress,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (lessons().length > 0) {
      <p-card [header]="part() === 'hero' ? undefined : all().length > 0 ? t.title : t.nearest">
        <ul class="tb-list">
          @for (lesson of lessons(); track lesson.id) {
            @if (lesson.id === nextId() && part() === 'hero' && clock(); as time) {
              <!-- board D: the time tile, who, the actions on one line; the board and the presence
                   under the name; the elapsed time along the bottom -->
              <li class="tb-today-lesson--next tb-today-hero">
                <tb-lesson-time-tile class="tb-today-hero__tile" [time]="time" />
                <tb-avatar
                  class="tb-today-hero__avatar"
                  size="4rem"
                  [name]="with(lesson)"
                  [photo]="lesson.studentAvatar"
                />
                <div class="tb-today-hero__who">
                  <strong class="tb-today-hero__name">{{ with(lesson) }}</strong>
                  @if (subject(lesson); as subject) {
                    <span>{{ subject }}</span>
                  }
                  <span class="tb-today-lesson__end">{{ t.until(clockTime(lesson.endsAt)) }}</span>
                </div>
                <tb-board-links
                  class="tb-today-hero__board"
                  [chips]="true"
                  [latest]="true"
                  [studentId]="lesson.groupId === null ? lesson.studentId : null"
                  [groupId]="lesson.groupId"
                />
                @if (lesson.joinUrl; as url) {
                  @if (time.phase === 'live' && portalRoom(lesson); as ownerId) {
                    <tb-call-summon [ownerId]="ownerId" [hero]="true">
                      <tb-join-lesson-button
                        [url]="url"
                        [label]="t.join"
                        [teacher]="true"
                        [medium]="true"
                      />
                    </tb-call-summon>
                  } @else {
                    <tb-join-lesson-button
                      class="tb-today-hero__join"
                      [url]="url"
                      [label]="time.phase === 'live' ? t.join : t.start"
                      [teacher]="true"
                      [medium]="true"
                    />
                  }
                }
                @if (time.phase === 'live') {
                  <tb-wavy-progress
                    class="tb-today-hero__progress"
                    [value]="(time.elapsed / lesson.durationMinutes) * 100"
                    [label]="t.elapsed(time.elapsed, lesson.durationMinutes)"
                  />
                }
              </li>
            } @else if (lesson.id === nextId() && clock(); as time) {
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
                <div class="tb-today-lesson__tools">
                  <tb-board-links
                    [chips]="true"
                    [latest]="true"
                    [studentId]="lesson.groupId === null ? lesson.studentId : null"
                    [groupId]="lesson.groupId"
                  />
                  @if (time.phase === 'live' && portalRoom(lesson); as ownerId) {
                    <tb-call-summon [ownerId]="ownerId" />
                  }
                </div>
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
                  <span
                    class="tb-today-lesson__status tb-today-lesson__status--{{ lesson.status }}"
                  >
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
    }
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
      /* the hero's colour (its text roles: styles/_home.scss), the portal colour as the card «Идёт сейчас»
         was; set here, as the list's own row colour would win over the global rule */
      background: var(--p-md-primary-container);
      color: var(--p-md-on-primary-container);
      overflow-wrap: anywhere;
    }

    .tb-today-lesson--next tb-avatar {
      background: var(--p-md-surface);
    }

    .tb-today-lesson--next tb-board-links:empty {
      display: none;
    }

    /* the board, then «… ещё не в звонке · Позвать» on its own line (board 1) */
    .tb-today-lesson__tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2) var(--tb-space-3);
      min-width: 0;

      &:not(:has(> :not(:empty))) {
        display: none;
      }

      > tb-call-summon {
        flex: 1 1 100%;
      }
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

    /*
     * The hero from large (board D): tile, avatar, who and the actions on one line; the board and the
     * presence (tb-call-summon's line, area presence) under the name; the wavy bar of the elapsed time
     * along the bottom. 20 dp between the line's parts and 16 dp between the lines (the sketch; ours)
     */
    .tb-today-hero {
      display: grid;
      grid-template-columns: auto auto auto minmax(0, 1fr) auto;
      grid-template-areas:
        'tile avatar who who actions'
        '. . board presence .'
        'bar bar bar bar bar';
      gap: var(--tb-space-4) var(--tb-space-5);
      align-items: center;
      padding: var(--tb-space-5) var(--tb-space-6) var(--tb-space-4);
      overflow-wrap: anywhere;
    }

    /* the hero card (M3 filled card, 28 dp: the sketch), not the list row's 16 dp */
    .tb-list > .tb-today-hero {
      border-radius: var(--tb-shape-xl);
    }

    .tb-today-hero__tile {
      grid-area: tile;
    }

    .tb-today-hero__avatar {
      grid-area: avatar;
      background: var(--p-md-surface);
    }

    .tb-today-hero__who {
      grid-area: who;
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
      min-width: 0;
      font: var(--tb-type-body-l);
    }

    /* the one name of the page in an emphasized headline (M3E: emphasized marks the hero) */
    .tb-today-hero__name {
      font: var(--tb-type-headline-m-emphasized);
    }

    .tb-today-hero__board {
      grid-area: board;

      &:empty {
        display: none;
      }
    }

    .tb-today-hero__join {
      grid-area: actions;
    }

    .tb-today-hero__progress {
      grid-area: bar;
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

      /* board 4: the summon line ends the board's line */
      .tb-today-lesson__tools > tb-call-summon {
        flex: 0 1 auto;
        margin-inline-start: auto;
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
  /**
   * What it shows: everything (one column), only the expanded lesson (`hero`, across the page from large) or
   * the other rows (`rest`, beside the hero).
   */
  readonly part = input<'all' | 'hero' | 'rest'>('all');
  /** The expanded lesson is over: the home page loads the next one. */
  readonly over = output();

  private readonly nextToday = computed(() =>
    this.all().some((lesson) => lesson.id === this.next()?.id),
  );
  protected readonly lessons = computed(() => {
    const next = this.next();
    const today = [...this.all()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const lessons = next === null || this.nextToday() ? today : [...today, next];
    switch (this.part()) {
      case 'hero':
        return lessons.filter((lesson) => lesson.id === next?.id);
      case 'rest':
        return lessons.filter((lesson) => lesson.id !== next?.id);
      default:
        return lessons;
    }
  });
  protected readonly nextId = computed(() => this.next()?.id ?? null);
  protected readonly clock = injectLessonClock(this.next, () => {
    // the rows beside the hero do not reload the page a second time
    if (this.part() !== 'rest') {
      this.over.emit();
    }
  });
  protected readonly with = lessonWith;

  /** The owner of the portal's own room of the lesson; `null` for an external link (presence unknown). */
  protected portalRoom(lesson: ScheduledLesson): string | null {
    return lesson.joinUrl?.includes('/call/') === true
      ? (lesson.groupId ?? lesson.studentId)
      : null;
  }

  /** «Английский · Past Simple»: the title and the topic of the hero, either may be missing. */
  protected subject(lesson: ScheduledLesson): string {
    return [lesson.title, lesson.topic].filter((part) => part !== null).join(' · ');
  }

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
