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
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { toIsoDate } from '@shared/dates/iso-date';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { LessonsOf, ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import {
  ATTENDANCE_LABELS,
  STATUS_LABELS,
  TagSeverity,
  formatLessonTime,
  lessonWith,
} from '../schedule-labels';
import { T } from '../i18n/texts';

/** How far ahead and back the first read looks (the backend allows 400 days at most). */
const AHEAD_DAYS = 180;
const BACK_DAYS = 180;
/** How far «Показать ранее» goes back each time. */
const EARLIER_DAYS = 360;
const DAY_MS = 86_400_000;

/** A row of the tab: the lesson with the tag of its outcome. */
interface LessonRow {
  readonly lesson: ScheduledLesson;
  readonly tag: { readonly label: string; readonly severity: TagSeverity } | null;
}

/** A card of the tab: the lessons ahead or the past ones. */
interface LessonSection {
  readonly title: string;
  readonly empty: string;
  readonly icon: string;
  readonly rows: readonly LessonRow[];
  /** The past: it can read further back. */
  readonly past: boolean;
}

function daysFrom(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * The Занятия tab of a student's or a group's card (redesign spec §8): the lessons ahead, the nearest first,
 * and the past ones, the latest first, with their outcome — for a student in a group lesson, the student's
 * own attendance. «Показать ранее» reads the year before.
 */
@Component({
  selector: 'tb-student-lessons-tab',
  imports: [Button, Card, EmptyState, LoadStateView, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      <div class="tb-student-lessons-tab">
        @for (section of sections(); track section.title) {
          <p-card [header]="section.title">
            @if (section.rows.length === 0) {
              <tb-empty-state [compact]="true" [icon]="section.icon" [title]="section.empty" />
            } @else {
              <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="section.title">
                @for (row of section.rows; track row.lesson.id) {
                  <li [class.tb-inactive]="row.lesson.status === 'CANCELLED'">
                    <span class="tb-list__lead" aria-hidden="true"
                      ><i
                        class="tb-i"
                        [class.tb-i-group]="row.lesson.groupId !== null"
                        [class.tb-i-event]="row.lesson.groupId === null"
                      ></i
                    ></span>
                    <div class="tb-list__text">
                      <span class="tb-list__title">{{ time(row.lesson) }}</span>
                      <span class="tb-list__supporting">{{ details(row.lesson) }}</span>
                    </div>
                    @if (row.tag !== null) {
                      <div class="tb-list__trail">
                        <p-tag [value]="row.tag.label" [severity]="row.tag.severity" />
                      </div>
                    }
                  </li>
                }
              </ul>
            }
            @if (section.past) {
              <p-button
                [label]="t.earlier"
                [text]="true"
                [loading]="loadingEarlier()"
                (onClick)="earlier()"
              />
            }
          </p-card>
        }
      </div>
    </tb-load-state>
  `,
  styles: `
    .tb-student-lessons-tab {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }
  `,
})
export class StudentLessonsTab {
  protected readonly t = T.lessonsTab;
  private readonly api = inject(ScheduleApi);

  /** Whose lessons: a student (alone or in a group) or a group. */
  readonly of = input.required<LessonsOf>();
  /** Changed by the card when it planned a lesson: the lessons are read again. */
  readonly revision = input(0);

  protected readonly state = new LoadState();
  protected readonly loadingEarlier = signal(false);
  private readonly lessons = signal<readonly ScheduledLesson[]>([]);
  /** The first day read so far. */
  private from = new Date();

  private readonly upcoming = computed<LessonRow[]>(() => {
    const now = Date.now();
    return this.lessons()
      .filter((lesson) => new Date(lesson.endsAt).getTime() > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((lesson) => ({
        lesson,
        tag: lesson.status === 'SCHEDULED' ? null : STATUS_LABELS[lesson.status],
      }));
  });
  private readonly past = computed<LessonRow[]>(() => {
    const now = Date.now();
    return this.lessons()
      .filter((lesson) => new Date(lesson.endsAt).getTime() <= now)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .map((lesson) => ({ lesson, tag: this.outcome(lesson) }));
  });

  protected readonly sections = computed<LessonSection[]>(() => [
    {
      title: this.t.upcoming,
      empty: this.t.noUpcoming,
      icon: 'tb-i-event',
      rows: this.upcoming(),
      past: false,
    },
    {
      title: this.t.past,
      empty: this.t.noPast,
      icon: 'tb-i-history',
      rows: this.past(),
      past: true,
    },
  ]);

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
    this.from = daysFrom(today, -BACK_DAYS);
    this.api
      .lessons(toIsoDate(this.from), toIsoDate(daysFrom(today, AHEAD_DAYS)), this.of())
      .pipe(this.state.track())
      .subscribe((lessons) => {
        this.lessons.set(lessons);
      });
  }

  /** The year before what is shown; the lessons already shown stay. */
  protected earlier(): void {
    const to = daysFrom(this.from, -1);
    const from = daysFrom(this.from, -EARLIER_DAYS);
    this.loadingEarlier.set(true);
    this.api.lessons(toIsoDate(from), toIsoDate(to), this.of()).subscribe({
      next: (lessons) => {
        this.loadingEarlier.set(false);
        this.from = from;
        const known = new Set(this.lessons().map((lesson) => lesson.id));
        this.lessons.update((shown) => [
          ...shown,
          ...lessons.filter((lesson) => !known.has(lesson.id)),
        ]);
      },
      error: () => {
        this.loadingEarlier.set(false);
      },
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

  /**
   * A past lesson: its status; a group lesson that took place — the student's own attendance; an unmarked
   * one — «Запланировано», so the teacher sees it waits for the outcome.
   */
  private outcome(lesson: ScheduledLesson): LessonRow['tag'] {
    const of = this.of();
    if (lesson.groupId !== null && lesson.status === 'CONDUCTED' && 'studentId' in of) {
      const own = lesson.participants.find((participant) => participant.studentId === of.studentId);
      if (own !== undefined && own.attendance !== 'EXPECTED') {
        return ATTENDANCE_LABELS[own.attendance];
      }
    }
    return STATUS_LABELS[lesson.status];
  }
}
