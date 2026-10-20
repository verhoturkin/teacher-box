import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button, ButtonDirective, ButtonIcon } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Snackbar } from '@core/snackbar/snackbar';
import { AiApi } from '@features/ai/parts';
import { ToBoardDialog } from '@features/boards/parts';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { HomeworkApi } from '../data-access/homework-api';
import { ReviewDecision, TaskDetails } from '../data-access/homework.models';
import { T } from '../i18n/texts';

/** What the AI brought for the work: shown in its own block until the teacher takes it. */
interface Draft {
  readonly comment: string;
  readonly grade: string | null;
  readonly decision: ReviewDecision;
}

/** The next work of the queue: its student and where it is. */
export interface NextWork {
  readonly taskId: string;
  readonly studentName: string;
}

/**
 * The review of a work as the third pane of the extra-large window (redesign spec §9, a standard side
 * sheet): «Проверка» with the place of the work in the queue («1 из 3») and the close button, the AI draft
 * («Вставить» takes it), the comment for the student, the quick phrases, the grade, the decision —
 * «На доработку» (tonal) and «Принять» (filled) — and «Дальше: <student>». The sheet holds the form of the
 * work it is given; the work itself lies in the detail pane beside it.
 */
@Component({
  selector: 'tb-review-sheet',
  imports: [
    ReactiveFormsModule,
    Button,
    ButtonDirective,
    ButtonIcon,
    InputText,
    Textarea,
    FieldErrors,
    ToBoardDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-sheet__head">
      <h2 class="tb-sheet__title">{{ t.sheetTitle }}</h2>
      @if (total() > 0 && place() > 0) {
        <span class="tb-sheet__place">{{ t.position(place(), total()) }}</span>
      }
      <button
        pButton
        type="button"
        [text]="true"
        [rounded]="true"
        severity="secondary"
        [attr.aria-label]="t.closeReview"
        (click)="closed.emit()"
      >
        <i pButtonIcon class="tb-i tb-i-close" aria-hidden="true"></i>
      </button>
    </div>

    <form tbFieldErrors class="tb-sheet__form" [formGroup]="form">
      @if (draft(); as draft) {
        <section class="tb-sheet__draft" [attr.aria-label]="t.aiDraft">
          <div class="tb-sheet__draft-head">
            <span class="tb-sheet__tag">
              <i class="tb-i tb-i-auto_awesome" aria-hidden="true"></i>{{ t.aiDraft }}
            </span>
            <button type="button" class="tb-sheet__insert" (click)="insert(draft)">
              {{ t.insert }}
            </button>
          </div>
          <p class="tb-sheet__draft-text">{{ draft.comment }}</p>
          <p class="tb-sheet__hint">
            {{ draft.decision === 'ACCEPT' ? t.suggestsAccept : t.suggestsReturn }}
          </p>
        </section>
      } @else if (aiAvailable()) {
        <div>
          <p-button
            [label]="t.askAi"
            icon="tb-i tb-i-auto_awesome"
            severity="secondary"
            [loading]="drafting()"
            (onClick)="askAi()"
          />
        </div>
      }

      <div class="tb-sheet__field">
        <label for="sheet-comment">{{ t.commentToStudent }}</label>
        <textarea pTextarea id="sheet-comment" formControlName="comment" rows="6"></textarea>
      </div>

      <div class="tb-sheet__chips" role="group" [attr.aria-label]="t.quick">
        <button type="button" class="tb-sheet__chip" (click)="phrase(t.greatText)">
          {{ t.great }}
        </button>
        <button type="button" class="tb-sheet__chip" (click)="phrase(t.mistakeText)">
          {{ t.mistake }}
        </button>
        <button type="button" class="tb-sheet__chip" (click)="phrase(t.recheckText)">
          {{ t.recheck }}
        </button>
      </div>

      <div class="tb-sheet__field">
        <label for="sheet-grade">{{ t.grade }}</label>
        <input
          pInputText
          id="sheet-grade"
          formControlName="grade"
          autocomplete="off"
          [placeholder]="t.gradePlaceholder"
        />
      </div>
    </form>

    <div class="tb-sheet__decision">
      <p-button
        [label]="t.rework"
        severity="secondary"
        [loading]="pending()"
        (onClick)="review('RETURN')"
      />
      @if (task().status === 'SUBMITTED') {
        <p-button
          [label]="t.accept"
          icon="tb-i tb-i-check"
          [loading]="pending()"
          (onClick)="review('ACCEPT')"
        />
      }
    </div>
    <div class="tb-sheet__foot">
      @if (next(); as next) {
        <button type="button" class="tb-sheet__next" (click)="opened.emit(next.taskId)">
          <i class="tb-i tb-i-arrow_forward" aria-hidden="true"></i>{{ t.next(next.studentName) }}
        </button>
      }
      <p-button
        [label]="t.toBoard"
        icon="tb-i tb-i-co_present"
        [text]="true"
        [disabled]="commentValue().trim() === ''"
        (onClick)="boardVisible.set(true)"
      />
    </div>

    <tb-to-board-dialog
      [(visible)]="boardVisible"
      [title]="t.boardTitle(task().assignment.title)"
      [markdown]="reviewText()"
      [students]="[task().studentId]"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
      min-block-size: 100%;
    }

    .tb-sheet__head {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      /* the close button's own padding does not push the title in */
      margin-inline-end: calc(-1 * var(--tb-space-3));
    }

    .tb-sheet__title {
      flex: 1;
      margin: 0;
      font: var(--tb-type-headline-s);
    }

    .tb-sheet__place {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-sheet__form {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-4);
    }

    /* the draft: a block of the pane's surface on the tonal sheet (the sketch) */
    .tb-sheet__draft {
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface);
    }

    .tb-sheet__draft-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-3);
    }

    /* ours: «Черновик ИИ» is a tertiary tag (spec §9) */
    .tb-sheet__tag {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
      padding: var(--tb-space-1) var(--tb-space-2);
      border-radius: var(--tb-shape-full);
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
      font: var(--tb-type-label-m);
    }

    .tb-sheet__tag .tb-i {
      font-size: 1rem;
    }

    .tb-sheet__insert {
      padding: var(--tb-space-1) var(--tb-space-2);
      border: 0;
      border-radius: var(--tb-shape-sm);
      background: none;
      color: var(--p-md-primary);
      font: var(--tb-type-label-l);
      cursor: pointer;
    }

    .tb-sheet__insert:focus-visible,
    .tb-sheet__next:focus-visible {
      outline: 3px solid var(--p-md-secondary);
    }

    .tb-sheet__draft-text {
      margin: var(--tb-space-3) 0 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
      white-space: pre-line;
    }

    .tb-sheet__hint {
      margin: var(--tb-space-2) 0 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    .tb-sheet__field {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-1);
    }

    .tb-sheet__field label {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-sheet__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    /* M3 assist chip: 32 dp, 8 dp corners, 1 dp outline variant, label large; ours: a 48 dp target over it */
    .tb-sheet__chip {
      position: relative;
      block-size: 2rem;
      box-sizing: border-box;
      padding: 0 var(--tb-space-4);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-sm);
      background: transparent;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
      cursor: pointer;
      transition: background var(--tb-spring-fast-effects);
    }

    .tb-sheet__chip::before {
      content: '';
      position: absolute;
      inset-block: -0.5rem;
      inset-inline: 0;
    }

    .tb-sheet__chip:hover {
      background: color-mix(in srgb, var(--p-md-on-surface-variant) 8%, transparent);
    }

    .tb-sheet__chip:focus-visible {
      outline: 3px solid var(--p-md-secondary);
    }

    /* the decision stays at the foot of the sheet however long the comment is */
    .tb-sheet__decision {
      display: flex;
      gap: var(--tb-space-2);
      margin-block-start: auto;
    }

    .tb-sheet__decision p-button {
      flex: 1;
    }

    .tb-sheet__decision ::ng-deep .p-button {
      inline-size: 100%;
    }

    .tb-sheet__foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-3);
    }

    .tb-sheet__next {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-2);
      min-inline-size: 0;
      padding: 0;
      border: 0;
      background: none;
      color: var(--p-md-on-surface);
      font: var(--tb-type-body-m);
      text-align: start;
      cursor: pointer;
    }

    .tb-sheet__next:hover {
      text-decoration: underline;
    }
  `,
})
export class ReviewSheet {
  protected readonly t = T.review;
  private readonly api = inject(HomeworkApi);
  private readonly ai = inject(AiApi);
  private readonly snackbar = inject(Snackbar);

  /** The work under review (the detail pane shows it). */
  readonly task = input.required<TaskDetails>();
  /** The place of the work in the queue and its length: «1 из 3» (0: the work is not in the queue). */
  readonly place = input(0);
  readonly total = input(0);
  /** The next work of the queue. */
  readonly next = input<NextWork | null>(null);
  /** A decision is made: the work as it is now. */
  readonly reviewed = output<TaskDetails>();
  /** The teacher opens the next work. */
  readonly opened = output<string>();
  readonly closed = output();

  protected readonly pending = signal(false);
  protected readonly drafting = signal(false);
  protected readonly draft = signal<Draft | null>(null);
  protected readonly boardVisible = signal(false);
  private readonly aiEnabled = toSignal(this.ai.enabled$, { initialValue: false });
  /** Text of the latest submission that has one (only text is sent to the AI, files are not). */
  private readonly answer = computed(
    () =>
      this.task().submissions.find((submission) => (submission.text ?? '').trim() !== '')?.text ??
      null,
  );
  protected readonly aiAvailable = computed(
    () => this.aiEnabled() && this.task().status === 'SUBMITTED' && this.answer() !== null,
  );

  protected readonly form = new FormGroup({
    grade: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    comment: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] }),
  });
  protected readonly commentValue = toSignal(this.form.controls.comment.valueChanges, {
    initialValue: '',
  });
  private readonly gradeValue = toSignal(this.form.controls.grade.valueChanges, {
    initialValue: '',
  });
  /** The review for a board: the grade and the comment. */
  protected readonly reviewText = computed(() => {
    const grade = this.gradeValue().trim();
    return grade === ''
      ? this.commentValue()
      : `${T.review.gradeLine(grade)}\n\n${this.commentValue()}`;
  });

  constructor() {
    // another work: the form starts again
    effect(() => {
      const task = this.task();
      untracked(() => {
        this.draft.set(null);
        this.form.reset({ grade: task.grade ?? '', comment: task.teacherComment ?? '' });
      });
    });
  }

  protected askAi(): void {
    const answer = this.answer();
    if (answer === null || this.drafting()) {
      return;
    }
    const task = this.task();
    this.drafting.set(true);
    this.ai
      .reviewDraft({
        title: task.assignment.title,
        description: task.assignment.description,
        answer,
      })
      .subscribe({
        next: (draft) => {
          this.drafting.set(false);
          this.draft.set({
            comment: draft.comment,
            grade: draft.grade,
            decision: draft.accept ? 'ACCEPT' : 'RETURN',
          });
        },
        error: () => {
          this.drafting.set(false);
        },
      });
  }

  /** «Вставить»: the draft's comment (and grade) replace what is in the form. */
  protected insert(draft: Draft): void {
    this.form.patchValue({ comment: draft.comment, grade: draft.grade ?? '' });
  }

  /** A quick phrase goes after the comment, on a line of its own. */
  protected phrase(text: string): void {
    const control = this.form.controls.comment;
    const current = control.value.trimEnd();
    control.setValue(current === '' ? text : `${current}\n${text}`);
    control.markAsDirty();
  }

  protected review(decision: ReviewDecision): void {
    const task = this.task();
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const { grade, comment } = this.form.getRawValue();
    this.pending.set(true);
    this.api
      .review(
        task.taskId,
        decision,
        grade.trim() === '' ? null : grade.trim(),
        comment.trim() === '' ? null : comment,
      )
      .subscribe({
        next: (reviewed) => {
          this.pending.set(false);
          this.snackbar.success(decision === 'ACCEPT' ? T.review.accepted : T.review.returned);
          this.reviewed.emit(reviewed);
        },
        error: () => {
          this.pending.set(false);
        },
      });
  }
}
