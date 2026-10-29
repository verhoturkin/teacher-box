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
import { forkJoin } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { locale } from '@core/i18n/language';
import { fromIsoDate, toIsoDate } from '@shared/dates/iso-date';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownView } from '@shared/ui/markdown-view';
import { LessonsOf, ScheduleApi } from '../data-access/schedule-api';
import {
  HistoryEntry,
  ScheduledLesson,
  UpcomingKind,
  UpcomingSeries,
} from '../data-access/schedule.models';
import {
  ATTENDANCE_LABELS,
  STATUS_LABELS,
  TagSeverity,
  formatLessonStart,
  formatLessonTime,
  WEEKDAYS,
  lessonWith,
} from '../schedule-labels';
import { T } from '../i18n/texts';

/** How far ahead the lessons are read (the backend allows 400 days at most). */
const AHEAD_DAYS = 180;
/** A page of the history feed. */
const PAGE = 20;
const DAY_MS = 86_400_000;

interface Tone {
  readonly label: string;
  readonly severity: TagSeverity;
}

/** A row of the lessons ahead: the lesson with the tag of its status. */
interface LessonRow {
  readonly lesson: ScheduledLesson;
  readonly tag: Tone | null;
}

/** A row of the grouped lessons ahead: a series or a lesson of its own. */
interface GroupedRow {
  readonly key: string;
  readonly at: string;
  readonly title: string;
  readonly supporting: string;
  readonly group: boolean;
  readonly inactive: boolean;
  readonly tag: Tone | null;
}

const DAY_MONTH = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long' });
const LIST = new Intl.ListFormat(locale(), { type: 'conjunction' });
/** «вт», «Tue»: as the weekday reads inside a sentence (5 January 2026 is a Monday). */
const DAY_IN_TEXT = new Intl.DateTimeFormat(locale(), { weekday: 'short' });

function daysFrom(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * The Занятия tab of a student's or a group's card (redesign spec §8): the lessons ahead, the nearest first,
 * and the «История» feed of held lessons, the latest first, with their summary, plan and (a student's card)
 * the teacher's private note. «Показать ещё» reads the next page.
 */
@Component({
  selector: 'tb-student-lessons-tab',
  imports: [Button, Card, EmptyState, LoadStateView, MarkdownView, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-load-state [state]="state" [what]="t.what" (retry)="load()">
      <div class="tb-student-lessons-tab">
        <p-card [header]="t.upcoming">
          @if (upcoming().length === 0) {
            <tb-empty-state [compact]="true" icon="tb-i-event" [title]="t.noUpcoming" />
          } @else if (all()) {
            <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.upcoming">
              @for (row of upcoming(); track row.lesson.id) {
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
          } @else {
            <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.upcoming">
              @for (row of grouped(); track row.key; let first = $first) {
                <li [class.tb-inactive]="row.inactive">
                  <span
                    class="tb-list__lead"
                    [class.tb-list__lead--accent]="first"
                    aria-hidden="true"
                    ><i
                      class="tb-i"
                      [class.tb-i-group]="row.group"
                      [class.tb-i-event]="!row.group"
                    ></i
                  ></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ row.title }}</span>
                    <span class="tb-list__supporting">{{ row.supporting }}</span>
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
          @if (series().length > 0) {
            <p-button
              [label]="all() ? t.hideAll : t.showAll"
              [text]="true"
              (onClick)="all.set(!all())"
            />
          }
        </p-card>
        <p-card [header]="t.history">
          @if (history().length === 0) {
            <tb-empty-state [compact]="true" icon="tb-i-history" [title]="t.noHistory" />
          } @else {
            <ul class="tb-list tb-list--no-phone-lead" [attr.aria-label]="t.history">
              @for (entry of history(); track entry.lessonId) {
                <li>
                  <span class="tb-list__lead" aria-hidden="true"
                    ><i
                      class="tb-i"
                      [class.tb-i-group]="entry.groupId !== null"
                      [class.tb-i-event]="entry.groupId === null"
                    ></i
                  ></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ start(entry) }}</span>
                    <span class="tb-list__supporting">{{ entryDetails(entry) }}</span>
                    @if (entry.summary) {
                      <div class="tb-history__part">
                        <span class="tb-history__label">{{ t.covered }}</span>
                        <tb-markdown [text]="entry.summary" />
                      </div>
                    }
                    @if (entry.nextPlan) {
                      <p class="tb-history__part">
                        <span class="tb-history__label">{{ t.next }}</span>
                        {{ entry.nextPlan }}
                      </p>
                    }
                    @if (entry.note) {
                      <p class="tb-history__part">
                        <span class="tb-history__label">{{ t.note }}</span>
                        {{ entry.note }}
                      </p>
                    }
                  </div>
                  <div class="tb-list__trail">
                    <p-tag [value]="entryTag(entry).label" [severity]="entryTag(entry).severity" />
                  </div>
                </li>
              }
            </ul>
          }
          @if (more()) {
            <p-button
              [label]="t.showMore"
              [text]="true"
              [loading]="loadingMore()"
              (onClick)="loadMore()"
            />
          }
        </p-card>
      </div>
    </tb-load-state>
  `,
  styles: `
    .tb-student-lessons-tab {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }
    .tb-history__part {
      margin: var(--tb-space-2) 0 0;
      overflow-wrap: anywhere;
      white-space: pre-line;
    }
    .tb-history__label {
      display: block;
      font: var(--tb-type-label-m);
      color: var(--p-md-on-surface-variant);
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
  protected readonly loadingMore = signal(false);
  /** A full page came back, so there may be more. */
  protected readonly more = signal(false);
  private readonly lessons = signal<readonly ScheduledLesson[]>([]);
  protected readonly series = signal<readonly UpcomingSeries[]>([]);
  private readonly singles = signal<readonly { kind: UpcomingKind; lesson: ScheduledLesson }[]>([]);
  /** «Показать все даты»: every date ahead instead of a row per series. */
  protected readonly all = signal(false);
  protected readonly history = signal<readonly HistoryEntry[]>([]);

  protected readonly upcoming = computed<LessonRow[]>(() => {
    const now = Date.now();
    return this.lessons()
      .filter((lesson) => new Date(lesson.endsAt).getTime() > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((lesson) => ({
        lesson,
        tag: lesson.status === 'SCHEDULED' ? null : STATUS_LABELS[lesson.status],
      }));
  });

  /** A series is one row, one-off lessons and exceptions their own; the nearest first. */
  protected readonly grouped = computed<GroupedRow[]>(() =>
    [
      ...this.series().map((series) => this.seriesRow(series)),
      ...this.singles().map(({ kind, lesson }) => this.singleRow(kind, lesson)),
    ].sort((a, b) => a.at.localeCompare(b.at)),
  );

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
    forkJoin({
      lessons: this.api.lessons(
        toIsoDate(today),
        toIsoDate(daysFrom(today, AHEAD_DAYS)),
        this.of(),
      ),
      grouped: this.api.upcoming(this.of()),
      history: this.api.history(this.of(), null, PAGE),
    })
      .pipe(this.state.track())
      .subscribe(({ lessons, grouped, history }) => {
        this.lessons.set(lessons);
        this.series.set(grouped.series);
        this.singles.set(grouped.lessons);
        this.history.set(history);
        this.more.set(history.length === PAGE);
      });
  }

  /** The next page; what is shown stays. */
  protected loadMore(): void {
    const last = this.history().at(-1);
    this.loadingMore.set(true);
    this.api.history(this.of(), last?.startsAt ?? null, PAGE).subscribe({
      next: (page) => {
        this.loadingMore.set(false);
        this.history.update((shown) => [...shown, ...page]);
        this.more.set(page.length === PAGE);
      },
      error: () => {
        this.loadingMore.set(false);
      },
    });
  }

  /** «Каждый вт и чт, 15:00 · 60 мин» over «Английский · с 3 ноября · до 25 декабря · ещё 12». */
  private seriesRow(series: UpcomingSeries): GroupedRow {
    const days = WEEKDAYS.flatMap((day, index) =>
      series.weekdays.includes(day.value) ? [DAY_IN_TEXT.format(new Date(2026, 0, 5 + index))] : [],
    );
    return {
      key: series.ruleIds.join(),
      at: series.nextStartsAt,
      title: this.t.series(
        series.intervalWeeks,
        LIST.format(days),
        series.startTime.slice(0, 5),
        series.durationMinutes,
      ),
      supporting: [
        series.groupId === null || 'groupId' in this.of()
          ? null
          : lessonWith({ groupId: series.groupId, groupName: series.groupName, studentName: null }),
        series.title,
        this.t.since(DAY_MONTH.format(fromIsoDate(series.since))),
        series.endsOn === null ? null : this.t.until(DAY_MONTH.format(fromIsoDate(series.endsOn))),
        series.remaining === null ? null : this.t.left(series.remaining),
      ]
        .filter((part) => part !== null)
        .join(' · '),
      group: series.groupId !== null,
      inactive: false,
      tag: null,
    };
  }

  /** A moved lesson reads «чт, 05.11, 15:00» over «Перенесено на пт, 06.11, 16:00 · Английский». */
  private singleRow(kind: UpcomingKind, lesson: ScheduledLesson): GroupedRow {
    const moved = kind === 'MOVED' && lesson.originalStartsAt !== null;
    return {
      key: lesson.id,
      at: lesson.startsAt,
      title: moved ? formatLessonStart(lesson.originalStartsAt) : this.time(lesson),
      supporting: [
        moved ? this.t.movedTo(formatLessonStart(lesson.startsAt)) : null,
        kind === 'CHANGED' ? this.t.changed : null,
        lesson.groupId === null || 'groupId' in this.of() ? null : lessonWith(lesson),
        lesson.title ?? this.t.noTopic,
      ]
        .filter((part) => part !== null)
        .join(' · '),
      group: lesson.groupId !== null,
      inactive: lesson.status === 'CANCELLED',
      tag: lesson.status === 'SCHEDULED' ? null : STATUS_LABELS[lesson.status],
    };
  }

  protected time(lesson: ScheduledLesson): string {
    return formatLessonTime(lesson.startsAt, lesson.endsAt);
  }

  protected start(entry: HistoryEntry): string {
    return formatLessonStart(entry.startsAt);
  }

  /** «Группа «ОГЭ» · Теорема Виета · регулярное». */
  protected details(lesson: ScheduledLesson): string {
    return [
      lesson.groupId === null || 'groupId' in this.of() ? null : lessonWith(lesson),
      lesson.title ?? this.t.noTopic,
      lesson.seriesId === null ? null : this.t.recurring,
    ]
      .filter((part) => part !== null)
      .join(' · ');
  }

  /** «Группа «ОГЭ» · Теорема Виета»; the group is not named in its own feed. */
  protected entryDetails(entry: HistoryEntry): string {
    return [
      entry.groupId === null || 'groupId' in this.of()
        ? null
        : lessonWith({ groupId: entry.groupId, groupName: entry.groupName, studentName: null }),
      entry.title ?? this.t.noTopic,
    ]
      .filter((part) => part !== null)
      .join(' · ');
  }

  /** A student in a group lesson that took place: the student's own attendance; else the status. */
  protected entryTag(entry: HistoryEntry): Tone {
    if (entry.groupId !== null && entry.attendance !== null && entry.attendance !== 'EXPECTED') {
      return ATTENDANCE_LABELS[entry.attendance];
    }
    return STATUS_LABELS[entry.status];
  }
}
