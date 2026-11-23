import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { AiApi, AiModelChoice, AiModelPick } from '@features/ai/parts';
import { AssignmentSummary, HomeworkApi } from '@features/homework/parts';
import { LessonPlansApi } from '@features/textbooks/parts';
import { quietContext } from '@core/http/api-error.interceptor';
import { EditorAutosave } from '@shared/forms/editor-autosave';
import { ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

/**
 * The summary of a held lesson inside its card, one card like «Итог» and «ДЗ» (469.3): «Что прошли»
 * with the AI «Черновик»; the students of the lesson read it in their history. The text saves itself
 * a moment after the teacher stops typing and when the card closes; nothing is sent.
 *
 * With a plan on the lesson (466.3) the row has «По плану | Не всё по плану»: «По плану» shows no
 * field and clears the deviations, «Не всё по плану» (picked while deviations are saved) opens the
 * field for them, and the draft writes only the deviations.
 */
@Component({
  selector: 'tb-lesson-summary',
  imports: [FormsModule, Button, SelectButton, Textarea, AiModelPick],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = lesson();
    <!-- one card like «Итог» and «ДЗ»: the row «Что прошли» (with a plan, «По плану | Не всё по плану» at
         its end) and the field inside it; the text saves itself -->
    <ul class="tb-list tb-list--no-phone-lead tb-lesson-summary" [attr.aria-label]="t.title">
      <li>
        <span class="tb-list__lead" aria-hidden="true"><i class="tb-i tb-i-summarize"></i></span>
        <div class="tb-list__text">
          <span class="tb-list__title">{{ t.covered }}</span>
          @if (savedAt(); as at) {
            <span class="tb-list__supporting" role="status">{{ t.savedAt(at) }}</span>
          }
        </div>
        @if (byPlan()) {
          <div class="tb-list__trail">
            <!-- M3 connected button group, single-select: it changes what the card shows -->
            <p-selectbutton
              [options]="modes"
              optionLabel="label"
              optionValue="value"
              [allowEmpty]="false"
              [ngModel]="offPlanOpen() ? 'OFF_PLAN' : 'BY_PLAN'"
              (ngModelChange)="pickMode($event)"
              [ariaLabel]="t.covered"
            >
              <ng-template #item let-option>
                <i [class]="'tb-i tb-i-' + option.icon" aria-hidden="true"></i>
                <span>{{ option.label }}</span>
              </ng-template>
            </p-selectbutton>
          </div>
        }
      </li>
      @if (!byPlan() || offPlanOpen()) {
        <li class="tb-lesson-summary__body">
          <div class="tb-lesson-summary__tools">
            <span class="tb-hint" id="lesson-summary-hint">{{
              byPlan() ? t.offPlanHint : t.coveredHint
            }}</span>
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
                <small class="tb-hint">{{
                  byPlan() ? t.draftNeedsWords : t.draftNeedsInput
                }}</small>
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
          <textarea
            pTextarea
            id="lesson-summary-text"
            [attr.aria-label]="t.covered"
            aria-describedby="lesson-summary-hint"
            rows="4"
            maxlength="4000"
            [placeholder]="byPlan() ? t.draftPlanPlaceholder : t.coveredPlaceholder"
            [ngModel]="summary()"
            (ngModelChange)="type($event)"
          ></textarea>
        </li>
      }
    </ul>
  `,
  styles: `
    textarea {
      box-sizing: border-box;
      width: 100%;
      resize: vertical;
    }

    /* ours: the field row takes the whole width of the card under the row «Что прошли» */
    .tb-list > li.tb-lesson-summary__body {
      grid-template-areas: none;
      grid-template-columns: minmax(0, 1fr);
      row-gap: var(--tb-space-2);
    }

    /* the hint of the field and «Черновик» share a line */
    .tb-lesson-summary__tools {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      align-items: center;
      justify-content: space-between;
    }

    /* the toggle row keeps its own columns, as «Итог» does in the lesson card */
    @container (width > 26rem) {
      .tb-list > li:has(> .tb-list__trail p-selectbutton) {
        grid-template-columns: 2.5rem minmax(0, 1fr) auto;
        column-gap: var(--tb-space-4);
      }
    }

    @media (width < 37.5em) {
      @container (width > 26rem) {
        .tb-list > li:has(> .tb-list__trail p-selectbutton) {
          grid-template-columns: minmax(0, 1fr) auto;
        }
      }
    }

    /* a narrow card: the toggle goes under the text */
    @container (max-width: 26rem) {
      .tb-list > li:has(> .tb-list__trail p-selectbutton) {
        grid-template-areas: 'text text' 'trail trail';
      }
    }

    .tb-lesson-summary__draft {
      display: grid;
      gap: var(--tb-space-2);
      padding: var(--tb-space-3);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-high);
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

  // a string, so a lesson given again with the same text keeps what the teacher is typing
  private readonly savedSummary = computed(() => this.lesson().summary ?? '');
  /** With a plan the summary holds only the deviations from it (466.3). */
  protected readonly byPlan = computed(() => this.lesson().planId !== null);
  /** «Не всё по плану» was picked, or deviations are saved. */
  protected readonly offPlanOpen = linkedSignal(() => this.savedSummary() !== '');
  protected readonly summary = linkedSignal(() => this.savedSummary());
  private destroyed = false;
  /** «Что прошли» saves itself a moment after the teacher stops typing, and at once when the card closes. */
  private readonly autosave = new EditorAutosave<ScheduledLesson>({
    canSave: () => this.summary().trim() !== this.savedSummary(),
    snapshot: () => this.summary().trim(),
    write: () =>
      this.api
        .updateSummary(this.lesson().id, this.blankToNull(this.summary()))
        .pipe(map((lesson) => ({ assignment: lesson, complete: true }))),
    saved: ({ assignment }) => {
      if (!this.destroyed) {
        this.saved.emit(assignment);
      }
    },
    failed: (failure) => {
      this.snackbar.error(describeError(failure, this.t.failed));
    },
  });
  protected readonly savedAt = this.autosave.savedAt;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.autosave.run();
    });
  }

  /** The teacher typed: the text saves itself after a pause. */
  protected type(text: string): void {
    this.summary.set(text);
    this.autosave.schedule();
  }

  protected hasInput(lesson: ScheduledLesson): boolean {
    // the deviations come only from the teacher's words
    return (
      (!this.byPlan() && (lesson.topic ?? lesson.title ?? '').trim() !== '') ||
      this.words().trim() !== ''
    );
  }

  protected readonly modes = [
    { value: 'BY_PLAN', label: this.t.byPlan, icon: 'check_circle' },
    { value: 'OFF_PLAN', label: this.t.offPlanOpen, icon: 'edit_note' },
  ];

  /** «По плану» takes the deviations off at once; «Не всё по плану» opens the field. */
  protected pickMode(mode: 'BY_PLAN' | 'OFF_PLAN'): void {
    this.offPlanOpen.set(mode === 'OFF_PLAN');
    if (mode === 'BY_PLAN') {
      this.summary.set('');
      this.autosave.run();
    }
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
          const current = this.summary().trim();
          this.type(current === '' ? summary : `${current}\n\n${summary}`);
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

  private blankToNull(text: string): string | null {
    const trimmed = text.trim();
    return trimmed === '' ? null : trimmed;
  }
}
