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
import { toIsoDate } from '@shared/dates/iso-date';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { LessonsOf, ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { formatLessonTime, lessonWith } from '../schedule-labels';
import { T } from '../i18n/texts';

/** How far ahead the card looks. */
const DAYS = 60;
/** How many lessons it shows. */
const SHOWN = 3;
const DAY_MS = 86_400_000;

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
            @for (lesson of next(); track lesson.id) {
              <li>
                <span class="tb-list__lead" aria-hidden="true"
                  ><i
                    class="tb-i"
                    [class.tb-i-group]="lesson.groupId !== null"
                    [class.tb-i-event]="lesson.groupId === null"
                  ></i
                ></span>
                <div class="tb-list__text">
                  <span class="tb-list__title">{{ time(lesson) }}</span>
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

  protected time(lesson: ScheduledLesson): string {
    return formatLessonTime(lesson.startsAt, lesson.endsAt);
  }

  /** «Группа «ОГЭ» · Теорема Виета · регулярное». */
  protected details(lesson: ScheduledLesson): string {
    return [
      lesson.groupId === null || 'groupId' in this.of() ? null : lessonWith(lesson),
      lesson.topic ?? this.t.noTopic,
      lesson.seriesId === null ? null : this.t.recurring,
    ]
      .filter((part) => part !== null)
      .join(' · ');
  }
}
