import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { AiApi, AiModelChoice, AiModelPick } from '@features/ai/parts';
import { AssignmentSummary, HomeworkApi } from '@features/homework/parts';
import { LessonPlansApi } from '@features/textbooks/parts';
import { quietContext } from '@core/http/api-error.interceptor';
import { Busy } from '@shared/ui/busy';
import { ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

/**
 * The summary of a held lesson inside its card: «Что прошли» (prefilled with the topic while no
 * summary is saved; the students of the lesson see it), the AI «Черновик» and «Тема следующего
 * занятия». Nothing saves by itself: «Сохранить», or «Отправить ученику» that saves and tells the
 * participants too (not while «Что прошли» is empty).
 *
 * With a plan on the lesson (466.3) the field holds only the deviations: it is hidden behind
 * «Прошли по плану» and «Не всё по плану» (open while deviations are saved), is not prefilled, the
 * draft writes only the deviations, and an empty summary is sent as «Прошли по плану».
 */
@Component({
  selector: 'tb-lesson-summary',
  imports: [FormsModule, Button, Textarea, AiModelPick],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = lesson();
    <section class="tb-form tb-lesson-summary" [attr.aria-label]="t.title">
      <div class="tb-field">
        <div class="tb-field__header">
          @if (!byPlan() || offPlanOpen()) {
            <label for="lesson-summary-text">{{ byPlan() ? t.offPlan : t.covered }}</label>
          } @else {
            <span class="tb-lesson-summary__heading">{{ t.covered }}</span>
          }
          @if (aiEnabled()) {
            <p-button
              [label]="t.draft"
              icon="tb-i tb-i-auto_awesome"
              severity="secondary"
              [text]="true"
              [attr.aria-expanded]="draftOpen()"
              aria-controls="lesson-summary-draft"
              (onClick)="draftOpen.set(!draftOpen())"
            />
          }
        </div>
        @if (aiEnabled() && draftOpen()) {
          <div class="tb-lesson-summary__draft" id="lesson-summary-draft">
            <label for="lesson-summary-words">{{ t.draftWords }}</label>
            <textarea
              pTextarea
              id="lesson-summary-words"
              rows="2"
              maxlength="2000"
              [placeholder]="byPlan() ? t.draftPlanPlaceholder : t.draftPlaceholder"
              [ngModel]="words()"
              (ngModelChange)="words.set($event)"
            ></textarea>
            @if (error(); as message) {
              <small class="tb-error" role="alert">{{ message }}</small>
            } @else if (!hasInput(item)) {
              <small class="tb-hint">{{ byPlan() ? t.draftNeedsWords : t.draftNeedsInput }}</small>
            } @else if (noDeviations()) {
              <small class="tb-hint" role="status">{{ t.draftByPlan }}</small>
            }
            <div class="tb-actions">
              <tb-ai-model-pick />
              <p-button
                [label]="drafted() ? t.draftAgain : t.draftRun"
                [icon]="drafted() ? 'tb-i tb-i-refresh' : 'tb-i tb-i-auto_awesome'"
                [disabled]="!hasInput(item)"
                [loading]="drafting()"
                (onClick)="draft(item)"
              />
            </div>
          </div>
        }
        @if (byPlan() && !offPlanOpen()) {
          <p class="tb-lesson-summary__plan">
            <i class="tb-i tb-i-check_circle" aria-hidden="true"></i>{{ t.byPlan }}
          </p>
          <small class="tb-hint">{{ t.byPlanHint }}</small>
          <div>
            <p-button
              [label]="t.offPlanOpen"
              icon="tb-i tb-i-edit"
              severity="secondary"
              [text]="true"
              (onClick)="openOffPlan()"
            />
          </div>
        } @else {
          <textarea
            pTextarea
            id="lesson-summary-text"
            rows="4"
            maxlength="4000"
            aria-describedby="lesson-summary-text-hint"
            [ngModel]="summary()"
            (ngModelChange)="summary.set($event)"
          ></textarea>
          <small class="tb-hint" id="lesson-summary-text-hint">{{
            byPlan() ? t.offPlanHint : t.coveredHint
          }}</small>
        }
      </div>

      <div class="tb-field">
        <label for="lesson-summary-next">{{ t.nextPlan }}</label>
        <textarea
          pTextarea
          id="lesson-summary-next"
          rows="2"
          maxlength="1000"
          aria-describedby="lesson-summary-next-hint"
          [ngModel]="nextPlan()"
          (ngModelChange)="nextPlan.set($event)"
        ></textarea>
        <small class="tb-hint" id="lesson-summary-next-hint">{{ t.nextPlanHint }}</small>
      </div>

      <div class="tb-actions tb-lesson-summary__actions">
        <p-button
          [label]="t.save"
          severity="secondary"
          [disabled]="!changed() || busy.is('send')"
          [loading]="busy.is('save')"
          (onClick)="save(false)"
        />
        <p-button
          [label]="item.groupId === null ? t.send : t.sendGroup"
          [disabled]="(summary().trim() === '' && !byPlan()) || busy.is('save')"
          [loading]="busy.is('send')"
          (onClick)="save(true)"
        />
      </div>
    </section>
  `,
  styles: `
    textarea {
      box-sizing: border-box;
      width: 100%;
      resize: vertical;
    }

    /* ours: the summary is a part of its own, set apart from the facts of the lesson */
    .tb-lesson-summary {
      margin-top: var(--tb-space-4);
    }

    .tb-lesson-summary__draft {
      display: grid;
      gap: var(--tb-space-2);
      padding: var(--tb-space-3);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-high);
    }

    .tb-lesson-summary__actions {
      justify-content: flex-end;
    }

    /* the heading of «Что прошли» without its field: the look of a field label */
    .tb-lesson-summary__heading {
      font: var(--tb-type-label-l);
      letter-spacing: var(--tb-tracking-label-l);
    }

    /* M3: an icon with text takes its colour role; the 18px icon and the gap are our decision */
    .tb-lesson-summary__plan {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      margin: 0;
      font: var(--tb-type-body-l);
      letter-spacing: var(--tb-tracking-body-l);
      color: var(--p-md-on-surface);
    }

    .tb-lesson-summary__plan .tb-i {
      font-size: 1.125rem;
      color: var(--p-md-primary);
    }
  `,
})
export class LessonSummarySection {
  protected readonly t = T.lessonSummary;
  private readonly api = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);
  private readonly ai = inject(AiApi);
  private readonly model = inject(AiModelChoice);
  private readonly homework = inject(HomeworkApi);
  private readonly plans = inject(LessonPlansApi);
  protected readonly busy = new Busy();

  readonly lesson = input.required<ScheduledLesson>();
  /** The lesson as the last write returned it. */
  readonly saved = output<ScheduledLesson>();

  // the section is there only while a held lesson's card is open
  protected readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  protected readonly draftOpen = signal(false);
  protected readonly words = signal('');
  protected readonly drafting = signal(false);
  protected readonly drafted = signal(false);
  protected readonly error = signal<string | null>(null);
  /** The last draft found no deviations from the plan. */
  protected readonly noDeviations = signal(false);
  private assignments: readonly AssignmentSummary[] | null = null;

  // strings, so a lesson given again with the same texts keeps what the teacher is typing
  private readonly savedSummary = computed(() => this.lesson().summary ?? '');
  private readonly savedNextPlan = computed(() => this.lesson().nextPlan ?? '');
  /** With a plan the summary holds only the deviations from it (466.3). */
  protected readonly byPlan = computed(() => this.lesson().planId !== null);
  // with a plan the topic is the plan's, not a deviation: no prefill
  private readonly initialSummary = computed(() =>
    this.savedSummary() === '' && !this.byPlan()
      ? (this.lesson().topic ?? '')
      : this.savedSummary(),
  );
  /** «Не всё по плану» was opened, or deviations are saved. */
  protected readonly offPlanOpen = linkedSignal(() => this.savedSummary() !== '');
  protected readonly summary = linkedSignal(() => this.initialSummary());
  protected readonly nextPlan = linkedSignal(() => this.savedNextPlan());
  protected readonly changed = computed(
    () =>
      this.summary().trim() !== this.savedSummary() ||
      this.nextPlan().trim() !== this.savedNextPlan(),
  );

  protected hasInput(lesson: ScheduledLesson): boolean {
    // the deviations come only from the teacher's words
    return (
      (!this.byPlan() && (lesson.topic ?? lesson.title ?? '').trim() !== '') ||
      this.words().trim() !== ''
    );
  }

  protected openOffPlan(): void {
    this.offPlanOpen.set(true);
  }

  /** The draft goes into «Что прошли»: it fills an empty field and follows the text already there. */
  protected draft(lesson: ScheduledLesson): void {
    if (this.drafting() || !this.hasInput(lesson)) {
      return;
    }
    this.drafting.set(true);
    this.error.set(null);
    this.noDeviations.set(false);
    forkJoin({ titles: this.givenAt(lesson), planTitle: this.planTitle(lesson) })
      .pipe(
        switchMap(({ titles, planTitle }) =>
          this.model.send((modelId) =>
            this.ai.lessonSummary({
              topic: this.blankToNull(lesson.topic ?? lesson.title ?? ''),
              words: this.blankToNull(this.words()),
              ...(planTitle === null ? {} : { planTitle }),
              assignmentTitles: titles,
              modelId,
            }),
          ),
        ),
      )
      .subscribe({
        next: ({ summary }) => {
          this.drafted.set(true);
          this.drafting.set(false);
          if (summary.trim() === '') {
            // with a plan an empty draft means no deviations: the field stays as it is
            this.noDeviations.set(true);
            return;
          }
          this.offPlanOpen.set(true);
          // the topic prefilled the field: the draft replaces it rather than following it
          const current = this.summary().trim();
          const kept = current === '' || current === (lesson.topic ?? '').trim() ? '' : current;
          this.summary.set(kept === '' ? summary : `${kept}\n\n${summary}`);
        },
        error: (failure: unknown) => {
          this.error.set(describeError(failure, this.t.draftFailed));
          this.drafting.set(false);
        },
      });
  }

  /** The title of the lesson's plan for the draft; `null` without a plan, a stand-in if it fails to load. */
  private planTitle(lesson: ScheduledLesson): Observable<string | null> {
    if (lesson.planId === null) {
      return of(null);
    }
    return this.plans.get(lesson.planId, quietContext()).pipe(
      map((plan) => plan.title),
      catchError(() => of(this.t.planFallback)),
    );
  }

  /**
   * The titles of the assignments linked to the lesson (ADR-0071), in the order linked. The list is read once
   * and only when the lesson has homework; a failure just leaves the titles out.
   */
  private givenAt(lesson: ScheduledLesson): Observable<string[]> {
    const ids = lesson.assignmentIds;
    const titles = (all: readonly AssignmentSummary[]): string[] => {
      const byId = new Map(all.map((assignment) => [assignment.id, assignment.title]));
      return ids
        .map((id) => byId.get(id))
        .filter((title): title is string => title !== undefined)
        .slice(0, 20);
    };
    if (ids.length === 0) {
      return of([]);
    }
    if (
      this.assignments !== null &&
      ids.every((id) => this.assignments?.some((a) => a.id === id))
    ) {
      return of(titles(this.assignments));
    }
    return this.homework.assignments().pipe(
      catchError(() => of([] as AssignmentSummary[])),
      switchMap((all) => {
        this.assignments = all;
        return of(titles(all));
      }),
    );
  }

  /** Writes what changed, then sends when asked: the share goes after the write it needs. */
  protected save(send: boolean): void {
    const lesson = this.lesson();
    if (send ? this.summary().trim() === '' && !this.byPlan() : !this.changed()) {
      return;
    }
    const written = this.changed()
      ? this.api.updateSummary(
          lesson.id,
          this.blankToNull(this.summary()),
          this.blankToNull(this.nextPlan()),
        )
      : of(lesson);
    const request = send
      ? written.pipe(
          switchMap((result) => this.api.shareSummary(lesson.id).pipe(switchMap(() => of(result)))),
        )
      : written;
    this.busy.guard(send ? 'send' : 'save', request).subscribe({
      next: (result) => {
        this.saved.emit(result);
        this.snackbar.success(send ? this.t.sent : this.t.saved);
      },
      error: (failure: unknown) => {
        this.snackbar.error(describeError(failure, this.t.failed));
      },
    });
  }

  private blankToNull(text: string): string | null {
    const trimmed = text.trim();
    return trimmed === '' ? null : trimmed;
  }
}
