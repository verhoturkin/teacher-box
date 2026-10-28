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
 * Teacher: the quiz of a work (ADR-0052) — «Тест: 7 из 10» over the answers of the best attempt, the wrong ones
 * first, each with the key and a button that changes the verdict (the score and the suggested grade follow).
 */
@Component({
  selector: 'tb-quiz-review',
  imports: [Button, MarkdownView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tb-qr">
      <h2 class="tb-qr__label">
        {{ quiz().best ? t.title(quiz().best?.scorePoints ?? 0, quiz().maxPoints) : t.noAttempt }}
      </h2>
      @if (quiz().best) {
        <p class="tb-qr__hint">{{ t.attempts(quiz().attemptsUsed) }}</p>
      }
      @for (row of rows(); track row.result.question.id) {
        <article class="tb-qr-card" [class.tb-qr-card--wrong]="!row.result.correct">
          <header class="tb-qr-card__head">
            <h3 class="tb-qr-card__title">{{ t.question(row.number) }}</h3>
            <span class="tb-qr-card__verdict">
              <i
                class="tb-i"
                aria-hidden="true"
                [class.tb-i-check]="row.result.correct"
                [class.tb-i-close]="!row.result.correct"
              ></i>
              {{ row.result.correct ? t.right : t.wrong }} ·
              {{ t.points(row.result.points, row.result.question.points) }}
              @if (row.result.overridden) {
                · {{ t.overridden }}
              }
            </span>
          </header>
          <tb-markdown [text]="row.result.question.text" />
          <div>
            <div class="tb-qr__field-label">{{ t.studentAnswer }}</div>
            @for (line of mine(row.result); track $index) {
              <div>{{ line }}</div>
            } @empty {
              <div class="tb-qr__muted">{{ t.noAnswer }}</div>
            }
          </div>
          @if (!row.result.correct) {
            <div>
              <div class="tb-qr__field-label">{{ t.key }}</div>
              @for (line of key(row.result); track $index) {
                <div>{{ line }}</div>
              }
            </div>
          }
          <div>
            <p-button
              [label]="row.result.correct ? t.markWrong : t.markRight"
              [icon]="row.result.correct ? 'tb-i tb-i-close' : 'tb-i tb-i-check'"
              severity="secondary"
              [loading]="pending() === row.result.question.id"
              (onClick)="override(row.result)"
            />
          </div>
        </article>
      }
    </section>
  `,
  styles: `
    .tb-qr {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-3);
    }

    .tb-qr__label {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-qr__hint {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-qr-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-xs);
      background: var(--tb-list-item);
      overflow-wrap: anywhere;
    }

    .tb-qr-card--wrong {
      outline: 1px solid var(--p-md-error);
    }

    .tb-qr-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-qr-card__title {
      margin: 0;
      font: var(--p-md-title-medium, inherit);
    }

    .tb-qr-card__verdict {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--tb-space-1);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-qr__field-label,
    .tb-qr__muted {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
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

  /** Wrong first, then the teacher's order. */
  protected readonly rows = computed<Row[]>(() =>
    this.quiz()
      .results.map((result, index) => ({ number: index + 1, result }))
      .sort((a, b) => Number(a.result.correct) - Number(b.result.correct)),
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
