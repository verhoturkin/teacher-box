import { PaneHeader } from '@shared/ui/panes';
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
import { NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Button, ButtonDirective, ButtonIcon } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Snackbar } from '@core/snackbar/snackbar';
import { ToBoardDialog } from '@features/boards/parts';
import { SHARED_T } from '@shared/i18n/texts';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { ReviewDecision, TaskDetails } from '../data-access/homework.models';
import { T } from '../i18n/texts';

import { ReviewForm, ReviewSuggestion } from './review-form';

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
    PaneHeader,
    NgTemplateOutlet,
    ReactiveFormsModule,
    Drawer,
    ModalDrawer,
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
    @if (compact()) {
      <!-- M3 floating toolbar (spec §9): 64 dp, 16 dp margins; the comment is in a bottom sheet -->
      <div class="tb-toolbar" role="toolbar" [attr.aria-label]="t.sheetTitle">
        @if (aiAvailable() || draft() !== null) {
          <button
            type="button"
            class="tb-toolbar__icon"
            [class.tb-toolbar__icon--busy]="drafting()"
            [disabled]="drafting()"
            [attr.aria-label]="t.askAi"
            (click)="aiAction()"
          >
            <i class="tb-i tb-i-auto_awesome" aria-hidden="true"></i>
          </button>
        }
        <button
          type="button"
          class="tb-toolbar__icon"
          [class.tb-toolbar__icon--on]="commentValue().trim() !== ''"
          aria-haspopup="dialog"
          [attr.aria-label]="t.commentToStudent"
          (click)="commentOpen.set(true)"
        >
          <i class="tb-i tb-i-comment" aria-hidden="true"></i>
        </button>
        <p-button
          class="tb-toolbar__action"
          [label]="t.rework"
          severity="secondary"
          [loading]="pending()"
          (onClick)="review('RETURN')"
        />
        @if (task().status === 'SUBMITTED') {
          <p-button
            class="tb-toolbar__action"
            [label]="t.accept"
            [loading]="pending()"
            (onClick)="review('ACCEPT')"
          />
        }
      </div>

      <p-drawer
        tbModalDrawer
        [blockScroll]="true"
        [ariaCloseLabel]="c.close"
        [(visible)]="commentOpen"
        position="bottom"
        styleClass="tb-sheet"
        [header]="t.commentToStudent"
      >
        <ng-container [ngTemplateOutlet]="fields" />
        <div class="tb-sheet__decision">
          <p-button
            [label]="t.toBoard"
            icon="tb-i tb-i-co_present"
            severity="secondary"
            [disabled]="commentValue().trim() === ''"
            (onClick)="boardVisible.set(true)"
          />
          <p-button [label]="t.done" (onClick)="commentOpen.set(false)" />
        </div>
      </p-drawer>
    } @else {
      <ng-template tbPaneHeader
        ><div class="tb-sheet__head">
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
      </ng-template>
      <ng-container [ngTemplateOutlet]="fields" />

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
    }

    <!-- the AI draft, the comment, the quick phrases and the grade: in the sheet and in the phone's bottom sheet -->
    <ng-template #fields>
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
    </ng-template>

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

    /* M3 floating toolbar: a pill of surface container high, 64 dp, 16 dp from the edges, elevation 2 (ours:
       two icon buttons and the decision) */
    .tb-toolbar {
      position: fixed;
      z-index: 10;
      inset-inline: var(--tb-space-4);
      inset-block-end: calc(var(--tb-space-4) + env(safe-area-inset-bottom));
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: var(--tb-space-2);
      block-size: 4rem;
      box-sizing: border-box;
      padding-inline: var(--tb-space-2);
      border-radius: var(--tb-shape-full);
      background: var(--p-md-surface-container-high);
      box-shadow: var(--tb-elevation-2);
    }

    .tb-toolbar__icon {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      inline-size: 3rem;
      block-size: 3rem;
      padding: 0;
      border: 0;
      border-radius: var(--tb-shape-full);
      background: transparent;
      color: var(--p-md-on-surface-variant);
      cursor: pointer;
    }

    .tb-toolbar__icon--on {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-toolbar__icon--busy {
      opacity: 0.5;
    }

    .tb-toolbar__icon:focus-visible {
      outline: 3px solid var(--p-md-secondary);
    }

    .tb-toolbar__action {
      flex: 0 1 auto;
      min-inline-size: 0;
    }

    .tb-toolbar__action:first-of-type {
      flex-grow: 1;
    }

    .tb-toolbar__action ::ng-deep .p-button {
      inline-size: 100%;
      padding-inline: var(--tb-space-3);
      white-space: nowrap;
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
  protected readonly c = SHARED_T.common;
  private readonly reviewForm = new ReviewForm();
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
  /** A phone (compact, spec §9): the floating toolbar and the comment in a bottom sheet instead of the side sheet. */
  readonly compact = input(false);
  /** The comment sheet of the phone is open. */
  protected readonly commentOpen = signal(false);

  protected readonly pending = this.reviewForm.pending;
  protected readonly drafting = this.reviewForm.drafting;
  protected readonly draft = signal<ReviewSuggestion | null>(null);
  protected readonly boardVisible = signal(false);
  protected readonly aiAvailable = computed(
    () =>
      this.reviewForm.aiEnabled() &&
      this.task().status === 'SUBMITTED' &&
      this.reviewForm.latestAnswer(this.task()) !== null,
  );
  protected readonly form = this.reviewForm.form;
  protected readonly commentValue = this.reviewForm.commentValue;
  protected readonly reviewText = this.reviewForm.reviewText;

  constructor() {
    // another work: the form starts again
    let shown: TaskDetails | null = null;
    effect(() => {
      const task = this.task();
      untracked(() => {
        if (shown?.taskId === task.taskId) {
          this.reviewForm.refresh(shown, task);
        } else {
          this.draft.set(null);
          this.reviewForm.reset(task);
        }
        shown = task;
      });
    });
  }

  /** The toolbar's AI button: the draft comes into the comment sheet; one that is here is shown again. */
  protected aiAction(): void {
    if (this.draft() === null) {
      this.askAi();
    } else {
      this.commentOpen.set(true);
    }
  }

  protected askAi(): void {
    this.reviewForm.draft(this.task(), (draft) => {
      this.draft.set(draft);
      this.commentOpen.set(this.compact());
    });
  }

  /** «Вставить»: the draft's comment (and grade) replace what is in the form. */
  protected insert(draft: ReviewSuggestion): void {
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
    if (!revealErrors(this.form)) {
      // the wrong field is in the bottom sheet of a phone
      this.commentOpen.set(this.compact());
      return;
    }
    this.reviewForm.submit(task, decision, (reviewed) => {
      this.snackbar.success(decision === 'ACCEPT' ? T.review.accepted : T.review.returned);
      this.reviewed.emit(reviewed);
    });
  }
}
