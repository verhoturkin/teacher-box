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
import { Observable, catchError, of, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { AiApi } from '@features/ai/parts';
import { AssignmentSummary, HomeworkApi } from '@features/homework/parts';
import { Busy } from '@shared/ui/busy';
import { ScheduleApi } from '../data-access/schedule-api';
import { ScheduledLesson } from '../data-access/schedule.models';
import { T } from '../i18n/texts';

/**
 * The summary of a held lesson inside its card: «Что прошли» (prefilled with the topic while no
 * summary is saved; the students of the lesson see it), the AI «Черновик» and «Тема следующего
 * занятия». Nothing saves by itself: «Сохранить», or «Отправить ученику» that saves and tells the
 * participants too (not while «Что прошли» is empty).
 */
@Component({
  selector: 'tb-lesson-summary',
  imports: [FormsModule, Button, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let item = lesson();
    <section class="tb-form tb-lesson-summary" [attr.aria-label]="t.title">
      <div class="tb-field">
        <div class="tb-field__header">
          <label for="lesson-summary-text">{{ t.covered }}</label>
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
              [placeholder]="t.draftPlaceholder"
              [ngModel]="words()"
              (ngModelChange)="words.set($event)"
            ></textarea>
            @if (error(); as message) {
              <small class="tb-error" role="alert">{{ message }}</small>
            } @else if (!hasInput(item)) {
              <small class="tb-hint">{{ t.draftNeedsInput }}</small>
            }
            <div class="tb-actions">
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
          rows="4"
          maxlength="4000"
          aria-describedby="lesson-summary-text-hint"
          [ngModel]="summary()"
          (ngModelChange)="summary.set($event)"
        ></textarea>
        <small class="tb-hint" id="lesson-summary-text-hint">{{ t.coveredHint }}</small>
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
          [disabled]="summary().trim() === '' || busy.is('save')"
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
  `,
})
export class LessonSummarySection {
  protected readonly t = T.lessonSummary;
  private readonly api = inject(ScheduleApi);
  private readonly snackbar = inject(Snackbar);
  private readonly ai = inject(AiApi);
  private readonly homework = inject(HomeworkApi);
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
  private assignments: readonly AssignmentSummary[] | null = null;

  // strings, so a lesson given again with the same texts keeps what the teacher is typing
  private readonly savedSummary = computed(() => this.lesson().summary ?? '');
  private readonly savedNextPlan = computed(() => this.lesson().nextPlan ?? '');
  private readonly initialSummary = computed(() =>
    this.savedSummary() === '' ? (this.lesson().topic ?? '') : this.savedSummary(),
  );
  protected readonly summary = linkedSignal(() => this.initialSummary());
  protected readonly nextPlan = linkedSignal(() => this.savedNextPlan());
  protected readonly changed = computed(
    () =>
      this.summary().trim() !== this.savedSummary() ||
      this.nextPlan().trim() !== this.savedNextPlan(),
  );

  protected hasInput(lesson: ScheduledLesson): boolean {
    return (lesson.topic ?? lesson.title ?? '').trim() !== '' || this.words().trim() !== '';
  }

  /** The draft goes into «Что прошли»: it fills an empty field and follows the text already there. */
  protected draft(lesson: ScheduledLesson): void {
    if (this.drafting() || !this.hasInput(lesson)) {
      return;
    }
    this.drafting.set(true);
    this.error.set(null);
    this.givenAt(lesson)
      .pipe(
        switchMap((titles) =>
          this.ai.lessonSummary({
            topic: this.blankToNull(lesson.topic ?? lesson.title ?? ''),
            words: this.blankToNull(this.words()),
            assignmentTitles: titles,
          }),
        ),
      )
      .subscribe({
        next: ({ summary }) => {
          // the topic prefilled the field: the draft replaces it rather than following it
          const current = this.summary().trim();
          const kept = current === '' || current === (lesson.topic ?? '').trim() ? '' : current;
          this.summary.set(kept === '' ? summary : `${kept}\n\n${summary}`);
          this.drafted.set(true);
          this.drafting.set(false);
        },
        error: (failure: unknown) => {
          this.error.set(describeError(failure, this.t.draftFailed));
          this.drafting.set(false);
        },
      });
  }

  /**
   * Assignments are not bound to lessons: those given the same day to a student of the lesson are
   * taken as given at it. The list is read once; a failure just leaves the titles out.
   */
  private givenAt(lesson: ScheduledLesson): Observable<string[]> {
    const names = new Set(lesson.participants.map((participant) => participant.studentName));
    const day = new Date(lesson.startsAt).toDateString();
    const titles = (all: readonly AssignmentSummary[]): string[] =>
      all
        .filter(
          (assignment) =>
            new Date(assignment.createdAt).toDateString() === day &&
            assignment.students.some((student) => names.has(student)),
        )
        .map((assignment) => assignment.title)
        .slice(0, 20);
    if (this.assignments !== null) {
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
    if (send ? this.summary().trim() === '' : !this.changed()) {
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
