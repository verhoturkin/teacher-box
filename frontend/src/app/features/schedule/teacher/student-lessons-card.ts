import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Card } from 'primeng/card';
import { locale } from '@core/i18n/language';
import { toIsoDate } from '@shared/dates/iso-date';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { LessonsOf, ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { lessonWith } from '../schedule-labels';
import { T } from '../i18n/texts';

/** How far ahead the card looks. */
const DAYS = 60;
/** How many lessons it shows. */
const SHOWN = 3;
const DAY_MS = 86_400_000;

const DAY = new Intl.DateTimeFormat(locale(), {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
const START = new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });

/**
 * Overview of a student's or a group's card (redesign spec §8): the next planned lessons of the student —
 * alone or in a group — or of the group, with the time, the group and the topic.
 */
@Component({
  selector: 'tb-student-lessons-card',
  imports: [Card, EmptyState, LoadStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
        @if (next().length === 0) {
          <tb-empty-state [compact]="true" icon="tb-i-event" [title]="t.nothing" />
        } @else {
          <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.title">
            @for (lesson of next(); track lesson.id; let first = $first) {
              <li>
                <span class="tb-list__lead tb-lesson-tile" [class.tb-lesson-tile--next]="first">
                  <small>{{ day(lesson) }}</small>
                  <strong>{{ start(lesson) }}</strong>
                </span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ lesson.topic ?? t.noTopic }}</span>
                  <span class="tb-list__supporting">{{ details(lesson) }}</span>
                </div>
              </li>
            }
          </ul>
          @if (more() > 0) {
            <p class="tb-muted tb-student-lessons__more">{{ t.more(more()) }}</p>
          }
        }
      </tb-load-state>
    </p-card>
  `,
  styles: `
    /* the sketch: the date and the time in a tile, the nearest one filled (ours: 4 px corner step of the list) */
    .tb-lesson-tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 3.5rem;
      padding: var(--tb-space-1) var(--tb-space-2);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;

      small {
        font: var(--tb-type-label-s);
      }

      strong {
        font: var(--tb-type-title-m-emphasized);
      }
    }

    .tb-lesson-tile--next {
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);
    }

    .tb-student-lessons__more {
      margin: var(--tb-space-2) 0 0;
    }
  `,
})
export class StudentLessonsCard {
  protected readonly t = T.studentLessons;
  private readonly api = inject(ScheduleApi);

  /** Whose lessons: a student's (with their group lessons) or a group's. */
  readonly of = input.required<LessonsOf>();
  /** Changed by the card when it planned a lesson: the list is read again. */
  readonly revision = input(0);

  protected readonly state = new LoadState();
  private readonly lessons = signal<readonly ScheduledLesson[]>([]);
  private readonly upcoming = computed(() => {
    const now = Date.now();
    return this.lessons()
      .filter((lesson) => lesson.status === 'SCHEDULED' && new Date(lesson.endsAt).getTime() > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  });
  protected readonly next = computed(() => this.upcoming().slice(0, SHOWN));
  protected readonly more = computed(() => this.upcoming().length - this.next().length);

  constructor() {
    effect(() => {
      this.revision();
      this.of();
      untracked(() => {
        this.load();
      });
    });
  }

  protected load(): void {
    const today = new Date();
    this.api
      .lessons(toIsoDate(today), toIsoDate(new Date(today.getTime() + DAYS * DAY_MS)), this.of())
      .pipe(this.state.track())
      .subscribe((lessons) => {
        this.lessons.set(lessons);
      });
  }

  protected day(lesson: ScheduledLesson): string {
    return DAY.format(new Date(lesson.startsAt));
  }

  protected start(lesson: ScheduledLesson): string {
    return START.format(new Date(lesson.startsAt));
  }

  /** «Группа «ОГЭ» · 60 мин · регулярное». */
  protected details(lesson: ScheduledLesson): string {
    const minutes = Math.round(
      (new Date(lesson.endsAt).getTime() - new Date(lesson.startsAt).getTime()) / 60_000,
    );
    return [
      lesson.groupId === null || 'groupId' in this.of() ? null : lessonWith(lesson),
      T.clock.duration(minutes),
      lesson.seriesId === null ? null : this.t.recurring,
    ]
      .filter((part) => part !== null)
      .join(' · ');
  }
}
