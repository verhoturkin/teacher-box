import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Button } from 'primeng/button';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import { QuizReview, ReviewResult, TaskDetails } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { answerLines, keyLines } from '../student/quiz-section';

interface Row {
  readonly number: number;
  readonly result: ReviewResult;
}

/**
 * Teacher: the quiz of a work (ADR-0052, sketch 14) — a tonal block «Тест · 7 из 10 · лучшая из 2 попыток»
 * with a row per wrong answer (the number and the question, «ответ: ~~x~~ · ключ: y», a tonal «Засчитать»);
 * the right ones open under «Показать верные (N)». A verdict changes the score and the suggested grade.
 */
@Component({
  selector: 'tb-quiz-review',
  imports: [Button, MarkdownView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tb-qr" [attr.aria-label]="heading()">
      <div class="tb-qr__head">
        <h2 class="tb-qr__label">{{ heading() }}</h2>
        @if (quiz().best) {
          <span class="tb-qr__hint">{{ t.attempts(quiz().attemptsUsed) }}</span>
        }
      </div>
      @for (row of shown(); track row.result.question.id) {
        <article class="tb-qr-row">
          <i
            class="tb-i tb-qr-row__icon"
            aria-hidden="true"
            [class.tb-i-cancel]="!row.result.correct"
            [class.tb-i-check_circle]="row.result.correct"
            [class.tb-qr-row__icon--wrong]="!row.result.correct"
          ></i>
          <div class="tb-qr-row__text">
            <h3 class="tb-qr-row__question">
              <span class="tb-sr-only">{{ row.result.correct ? t.right : t.wrong }}:</span>
              <b>№{{ row.number }}</b> <tb-markdown [text]="row.result.question.text" />
            </h3>
            <div class="tb-qr-row__answer">
              {{ t.answerShort }}:
              @if (mine(row.result).join('; '); as answer) {
                @if (row.result.correct) {
                  {{ answer }}
                } @else {
                  <s>{{ answer }}</s>
                }
              } @else {
                {{ t.noAnswer }}
              }
              @if (!row.result.correct) {
                · {{ t.keyShort }}: <b class="tb-qr-row__key">{{ key(row.result).join('; ') }}</b>
              }
              @if (row.result.overridden) {
                · {{ t.overridden }}
              }
            </div>
          </div>
          <p-button
            [label]="row.result.correct ? t.markWrong : t.markRight"
            severity="secondary"
            [loading]="pending() === row.result.question.id"
            (onClick)="override(row.result)"
          />
        </article>
      }
      @if (rightCount() > 0) {
        <p-button
          class="tb-qr__toggle"
          [label]="showRight() ? t.hideRight : t.showRight(rightCount())"
          [text]="true"
          [ariaExpanded]="showRight()"
          (onClick)="showRight.set(!showRight())"
        />
      }
    </section>
  `,
  styles: `
    /* a tonal block on the pane (sketch 14: surface container, 20 dp corners, 16 dp padding) */
    .tb-qr {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg-plus);
      background: var(--p-md-surface-container);
    }

    .tb-qr__head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--tb-space-2);
    }

    .tb-qr__label {
      flex: 1;
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-qr__hint {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
    }

    /* a row: the pane's surface inside the block (12 dp corners) */
    .tb-qr-row {
      display: flex;
      align-items: flex-start;
      gap: var(--tb-space-3);
      padding: var(--tb-space-3);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-surface);
      font: var(--tb-type-body-m);
      overflow-wrap: anywhere;
    }

    .tb-qr-row__icon {
      color: var(--p-md-primary);
    }

    .tb-qr-row__icon--wrong {
      color: var(--p-md-error);
    }

    .tb-qr-row__text {
      flex: 1;
      min-inline-size: 0;
    }

    .tb-qr-row__question {
      margin: 0;
      font: inherit;
    }

    /* «№3 She has ___ three letters» on one line: the Markdown blocks of the question flow inline */
    .tb-qr-row__question tb-markdown,
    .tb-qr-row__question ::ng-deep :is(div, p) {
      display: inline;
      margin: 0;
    }

    .tb-qr-row__question b {
      margin-inline-end: 0.25em;
    }

    .tb-qr-row__answer {
      color: var(--p-md-on-surface-variant);
    }

    .tb-qr-row__key {
      color: var(--p-md-on-surface);
    }

    .tb-qr__toggle {
      align-self: flex-start;
    }
  `,
})
export class QuizReviewBlock {
  protected readonly t = T.quizReview;
  private readonly api = inject(HomeworkApi);

  readonly taskId = input.required<string>();
  readonly quiz = input.required<QuizReview>();
  /** The verdict was changed: the work as the server returned it. */
  readonly changed = output<TaskDetails>();
  protected readonly pending = signal<string | null>(null);
  /** «Показать верные»: the right answers open under the wrong ones. */
  protected readonly showRight = signal(false);

  protected readonly heading = computed(() => {
    const quiz = this.quiz();
    return quiz.best ? this.t.title(quiz.best.scorePoints ?? 0, quiz.maxPoints) : this.t.noAttempt;
  });

  /** Wrong first, then the teacher's order. */
  protected readonly rows = computed<Row[]>(() =>
    this.quiz()
      .results.map((result, index) => ({ number: index + 1, result }))
      .sort((a, b) => Number(a.result.correct) - Number(b.result.correct)),
  );
  protected readonly rightCount = computed(
    () => this.rows().filter((row) => row.result.correct).length,
  );
  protected readonly shown = computed(() =>
    this.showRight() ? this.rows() : this.rows().filter((row) => !row.result.correct),
  );

  protected mine(result: ReviewResult): string[] {
    return answerLines(result.question, result.answer);
  }

  protected key(result: ReviewResult): string[] {
    return keyLines(result.question);
  }

  protected override(result: ReviewResult): void {
    if (this.pending() !== null) {
      return;
    }
    this.pending.set(result.question.id);
    this.api.overrideQuizAnswer(this.taskId(), result.question.id, !result.correct).subscribe({
      next: (task) => {
        this.pending.set(null);
        this.changed.emit(task);
      },
      error: () => {
        this.pending.set(null);
      },
    });
  }
}
