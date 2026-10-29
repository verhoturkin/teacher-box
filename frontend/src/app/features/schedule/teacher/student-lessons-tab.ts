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
import { toIsoDate } from '@shared/dates/iso-date';
import { EmptyState } from '@shared/ui/empty-state';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownView } from '@shared/ui/markdown-view';
import { LessonsOf, ScheduleApi } from '../data-access/schedule-api';
import { HistoryEntry, ScheduledLesson } from '../data-access/schedule.models';
import {
  ATTENDANCE_LABELS,
  STATUS_LABELS,
  TagSeverity,
  formatLessonStart,
  formatLessonTime,
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
          } @else {
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
      history: this.api.history(this.of(), null, PAGE),
    })
      .pipe(this.state.track())
      .subscribe(({ lessons, history }) => {
        this.lessons.set(lessons);
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
