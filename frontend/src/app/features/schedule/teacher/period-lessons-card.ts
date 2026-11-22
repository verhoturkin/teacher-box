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
import { Tag } from 'primeng/tag';
import { EmptyState } from '@shared/ui/empty-state';
import { ListRow } from '@shared/ui/list-row';
import { LoadState } from '@shared/ui/load-state';
import { LoadStateView } from '@shared/ui/load-state-view';
import { MarkdownView } from '@shared/ui/markdown-view';
import { ScheduleApi } from '../data-access/schedule-api';
import { LessonsReport, PeriodLesson, PeriodOutcome } from '../data-access/schedule.models';
import { TagSeverity, formatLessonStart } from '../schedule-labels';
import { T } from '../i18n/texts';

/** The tag of an outcome: held is success, a charged miss is a warning, the rest stay quiet (our decision). */
const OUTCOME_SEVERITIES: Readonly<Record<PeriodOutcome, TagSeverity>> = {
  PLANNED: 'secondary',
  ATTENDED: 'success',
  MISSED: 'warn',
  LATE_CANCELLED: 'warn',
  EXCUSED: 'secondary',
  CANCELLED: 'secondary',
};

/**
 * The lessons of a student's period (the page «Итоги за период», roadmap 11 «AI»): the figures held and missed,
 * the excused and cancelled ones under them, and every lesson of the days `[from, to]` with its outcome and
 * «Что прошли». Read again when the student or the period changes.
 */
@Component({
  selector: 'tb-period-lessons-card',
  imports: [Card, EmptyState, ListRow, LoadStateView, MarkdownView, Tag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <tb-load-state [state]="state" [what]="t.what" [skeleton]="true" (retry)="load()">
        @if (report(); as report) {
          <dl class="tb-figures">
            <div class="tb-figure">
              <dt class="tb-figure__label">{{ t.held }}</dt>
              <dd class="tb-figure__value">{{ report.held }}</dd>
            </div>
            <div class="tb-figure">
              <dt class="tb-figure__label">{{ t.missed }}</dt>
              <dd class="tb-figure__value">{{ report.missed }}</dd>
            </div>
          </dl>
          @if (others().length > 0) {
            <p class="tb-period-lessons__others">{{ others().join(' · ') }}</p>
          }
          @if (report.lessons.length === 0) {
            <tb-empty-state [compact]="true" icon="tb-i-event_busy" [title]="t.nothing" />
          } @else {
            <ul
              class="tb-list tb-list--no-phone-lead tb-period-lessons"
              [attr.aria-label]="t.title"
            >
              @for (lesson of report.lessons; track lesson.lessonId) {
                <li tbListRow>
                  <span class="tb-list__lead" aria-hidden="true"
                    ><i
                      class="tb-i"
                      [class.tb-i-group]="lesson.groupId !== null"
                      [class.tb-i-event]="lesson.groupId === null"
                    ></i
                  ></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ start(lesson) }}</span>
                    @if (subject(lesson); as subject) {
                      <span class="tb-list__supporting">{{ subject }}</span>
                    }
                    @if (lesson.summary) {
                      <div class="tb-period-lessons__covered">
                        <span class="tb-period-lessons__label">{{ t.covered }}</span>
                        <tb-markdown [text]="lesson.summary" />
                      </div>
                    }
                  </div>
                  <div class="tb-list__trail">
                    <p-tag [value]="outcome(lesson)" [severity]="severities[lesson.outcome]" />
                  </div>
                </li>
              }
            </ul>
          }
        }
      </tb-load-state>
    </p-card>
  `,
  styles: `
    .tb-period-lessons {
      margin-block-start: var(--tb-space-4);
    }

    .tb-period-lessons__others {
      margin: var(--tb-space-2) 0 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      letter-spacing: var(--tb-tracking-body-m);
    }

    .tb-period-lessons__covered {
      margin: var(--tb-space-2) 0 0;
      overflow-wrap: anywhere;
    }

    .tb-period-lessons__label {
      display: block;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: var(--tb-tracking-label-m);
    }
  `,
})
export class PeriodLessonsCard {
  protected readonly t = T.periodLessons;
  protected readonly severities = OUTCOME_SEVERITIES;
  private readonly api = inject(ScheduleApi);

  readonly studentId = input.required<string>();
  /** ISO dates: the first and the last day of the period. */
  readonly from = input.required<string>();
  readonly to = input.required<string>();

  protected readonly state = new LoadState();
  protected readonly report = signal<LessonsReport | null>(null);
  /** The rarer outcomes, only those that happened. */
  protected readonly others = computed(() => {
    const report = this.report();
    if (report === null) {
      return [];
    }
    return [
      report.excused > 0 ? this.t.excused(report.excused) : null,
      report.cancelledByStudent > 0 ? this.t.cancelledByStudent(report.cancelledByStudent) : null,
      report.lateCancellations > 0 ? this.t.lateCancellations(report.lateCancellations) : null,
    ].filter((line): line is string => line !== null);
  });

  constructor() {
    effect(() => {
      this.studentId();
      this.from();
      this.to();
      untracked(() => {
        this.load();
      });
    });
  }

  protected load(): void {
    this.api
      .studentReport(this.studentId(), this.from(), this.to())
      .pipe(this.state.track())
      .subscribe((report) => {
        this.report.set(report);
      });
  }

  protected start(lesson: PeriodLesson): string {
    return formatLessonStart(lesson.startsAt);
  }

  /** The topic, else the title of the lesson. */
  protected subject(lesson: PeriodLesson): string | null {
    return lesson.topic ?? lesson.title;
  }

  protected outcome(lesson: PeriodLesson): string {
    const label = this.t.outcomes[lesson.outcome];
    return lesson.outcome === 'CANCELLED' && lesson.cancelledBy === 'STUDENT'
      ? `${label} ${this.t.byStudent}`
      : label;
  }
}
