import { DestroyRef, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { locale } from '@core/i18n/language';
import { ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

/** Before the start, between the start and the end, after the end. */
export type LessonPhase = 'upcoming' | 'live' | 'over';

/** What the time tile of the nearest lesson says at a moment. */
export interface LessonTime {
  readonly phase: LessonPhase;
  /** «Сегодня», «Завтра», «чт, 16.10» or «Идёт сейчас». */
  readonly day: string;
  /** «16:00». */
  readonly start: string;
  /** «60 мин»; within an hour of the start «через 25 мин»; during the lesson «ещё 20 мин». */
  readonly note: string;
}

/** Within this many minutes of the start the tile counts down instead of showing the duration. */
const SOON_MINUTES = 60;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
/** The tile shows minutes: a few ticks a minute keep it on time. */
const TICK_MS = 15_000;

const TIME = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat(locale(), {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

function midnight(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** «Сегодня», «Завтра» or «чт, 16.10». */
export function dayCaption(start: Date, now: Date): string {
  // rounded: a day with a DST change is 23 or 25 hours long
  const days = Math.round((midnight(start) - midnight(now)) / DAY_MS);
  if (days === 0) {
    return T.clock.today;
  }
  return days === 1 ? T.clock.tomorrow : DAY.format(start);
}

/** Whole minutes until the moment, at least one. */
function minutesUntil(moment: number, now: number): number {
  return Math.max(1, Math.ceil((moment - now) / MINUTE_MS));
}

/** The tile of a lesson at the moment `now` (ms), in the browser's time zone. */
export function lessonTime(
  lesson: Pick<ScheduledLesson, 'startsAt' | 'endsAt' | 'durationMinutes'>,
  now: number,
): LessonTime {
  const start = new Date(lesson.startsAt);
  const end = new Date(lesson.endsAt).getTime();
  const startText = TIME.format(start);
  if (now >= end) {
    return { phase: 'over', day: dayCaption(start, new Date(now)), start: startText, note: '' };
  }
  if (now >= start.getTime()) {
    return {
      phase: 'live',
      day: T.clock.live,
      start: startText,
      note: T.clock.left(minutesUntil(end, now)),
    };
  }
  const until = minutesUntil(start.getTime(), now);
  return {
    phase: 'upcoming',
    day: dayCaption(start, new Date(now)),
    start: startText,
    note: until <= SOON_MINUTES ? T.clock.in(until) : T.clock.duration(lesson.durationMinutes),
  };
}

/**
 * The tile of the lesson, kept current while the component lives; `ended` is called once a lesson is
 * over (the home page then loads the next one). Call in an injection context.
 */
export function injectLessonClock(
  lesson: Signal<ScheduledLesson | null>,
  ended: () => void,
): Signal<LessonTime | null> {
  const now = signal(Date.now());
  const timer = setInterval(() => {
    now.set(Date.now());
  }, TICK_MS);
  inject(DestroyRef).onDestroy(() => {
    clearInterval(timer);
  });
  const time = computed(() => {
    const current = lesson();
    return current === null ? null : lessonTime(current, now());
  });
  let reported: string | null = null;
  effect(() => {
    const current = lesson();
    if (current !== null && time()?.phase === 'over' && reported !== current.id) {
      reported = current.id;
      untracked(ended);
    }
  });
  return time;
}
