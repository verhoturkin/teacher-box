import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Button } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import { Question, QuizAnswer, QuizResult, QuizView } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import { QuizEdit, QuizPlayer } from './quiz-player';

/** Autosave waits for a pause in typing. */
const SAVE_DELAY_MS = 600;

/** The answer as lines of text for the result; matching gives a line per pair. */
export function answerLines(question: Question, answer: QuizAnswer | null): string[] {
  if (answer === null) {
    return [];
  }
  const text = (id: string): string =>
    question.options.find((option) => option.id === id)?.text ?? '';
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      return (answer.ids ?? []).map(text);
    case 'ORDERING':
      return (answer.ids ?? []).map((id, index) => `${String(index + 1)}. ${text(id)}`);
    case 'SHORT_TEXT':
      return answer.text ? [answer.text] : [];
    case 'NUMBER':
      return answer.number === null || answer.number === undefined ? [] : [String(answer.number)];
    case 'MATCHING':
      return question.pairs.flatMap((pair) => {
        const right = answer.pairs?.[pair.id];
        return right === undefined
          ? []
          : [`${pair.left} → ${question.pairs.find((p) => p.id === right)?.right ?? ''}`];
      });
  }
}

/** The key of a question as lines of text. */
export function keyLines(question: Question): string[] {
  switch (question.type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      return question.options.filter((o) => question.correct.includes(o.id)).map((o) => o.text);
    case 'ORDERING':
      return question.options.map((option, index) => `${String(index + 1)}. ${option.text}`);
    case 'SHORT_TEXT':
      return [...question.accepted];
    case 'NUMBER':
      return [
        question.value === null
          ? ''
          : `${String(question.value)}${question.tolerance ? ` ± ${String(question.tolerance)}` : ''}`,
      ];
    case 'MATCHING':
      return question.pairs.map((pair) => `${pair.left} → ${pair.right}`);
  }
}

/**
 * Student: the quiz of a task (ADR-0052) on the task page — a tonal card «Тест · N вопросов» with the
 * attempts, when the key shows and «Начать тест» / «Продолжить тест»; the test itself opens full screen
 * (`tb-quiz-player`) and its answers are saved as they change. After «Завершить тест» the best score,
 * the key when the teacher allows it, and a new attempt while there are some left. Nothing without
 * questions.
 */
@Component({
  selector: 'tb-quiz-section',
  imports: [NgTemplateOutlet, Button, MarkdownView, QuizPlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as quiz) {
      @if (quiz.questions.length > 0) {
        <section class="tb-quiz">
          <div class="tb-quiz__card">
            <h2 class="tb-quiz__title">
              <i class="tb-i tb-i-quiz" aria-hidden="true"></i>
              {{ t.cardTitle(quiz.questions.length) }}
            </h2>
            @if (quiz.best; as best) {
              <p class="tb-quiz__score">
                {{ t.bestResult(best.scorePoints ?? 0, best.maxPoints ?? quiz.maxPoints) }}
              </p>
            }
            <p class="tb-quiz__hint">
              {{
                quiz.attemptsAllowed === null
                  ? t.attemptsUnlimited
                  : t.attemptsLeft(quiz.attemptsLeft ?? 0)
              }}.
              {{ revealHint(quiz) }}
            </p>
            @if (quiz.openAttempt) {
              <p-button [label]="t.continue" (onClick)="playing.set(true)" />
            } @else if (quiz.canStart) {
              <p-button
                [label]="quiz.attemptsUsed === 0 ? t.start : t.newAttempt"
                [loading]="pending()"
                (onClick)="start()"
              />
            }
          </div>
          @for (result of quiz.results ?? []; track result.question.id; let n = $index) {
            <article class="tb-quiz-card" [class.tb-quiz-card--wrong]="!result.correct">
              <header class="tb-quiz-card__head">
                <h3 class="tb-quiz-card__title">{{ t.question(n + 1) }}</h3>
                <span class="tb-quiz-card__verdict">
                  <i
                    class="tb-i"
                    [class.tb-i-check]="result.correct"
                    [class.tb-i-close]="!result.correct"
                    aria-hidden="true"
                  ></i>
                  {{ result.correct ? t.right : t.wrong }} · {{ t.points(result.points) }}
                </span>
              </header>
              <tb-markdown [text]="result.question.text" />
              <ng-container
                [ngTemplateOutlet]="linesTpl"
                [ngTemplateOutletContext]="{
                  label: t.yourAnswer,
                  lines: mine(result),
                  empty: true,
                }"
              />
              @if (!result.correct) {
                <ng-container
                  [ngTemplateOutlet]="linesTpl"
                  [ngTemplateOutletContext]="{
                    label: t.correctAnswer,
                    lines: key(result),
                    empty: false,
                  }"
                />
              }
              @if (result.question.explanation; as explanation) {
                <div>
                  <div class="tb-quiz__field-label">{{ t.explanation }}</div>
                  <tb-markdown [text]="explanation" />
                </div>
              }
            </article>
          }
        </section>
        @if (quiz.openAttempt; as attempt) {
          <tb-quiz-player
            [(visible)]="playing"
            [questions]="quiz.questions"
            [(answers)]="answers"
            [title]="t.testTitle(title())"
            [subtitle]="t.attempt(quiz.attemptsUsed + 1, quiz.attemptsAllowed)"
            [hint]="revealHint(quiz)"
            [pending]="pending()"
            (edited)="edited($event)"
            (settle)="flush()"
            (visibleChange)="$event || flush()"
            (finished)="submit(attempt.id)"
          />
        }
      }
    }

    <ng-template #linesTpl let-label="label" let-lines="lines" let-empty="empty">
      <div>
        <div class="tb-quiz__field-label">{{ label }}</div>
        @for (line of lines; track $index) {
          <div class="tb-quiz__line">{{ line }}</div>
        } @empty {
          @if (empty) {
            <div class="tb-quiz__line tb-quiz__line--muted">{{ t.noAnswer }}</div>
          }
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }

    .tb-quiz {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-3);
    }

    /* the test card of sketch 8: primary-container (ours, as the «Ближайшее» card) */
    .tb-quiz__card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--tb-space-2);
      padding: var(--tb-space-4) var(--tb-space-5);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-primary-container);
      color: var(--p-md-on-primary-container);
    }

    .tb-quiz__title {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      margin: 0;
      font: var(--tb-type-title-m);
    }

    .tb-quiz__hint,
    .tb-quiz__score {
      margin: 0;
    }

    .tb-quiz__hint {
      font: var(--tb-type-body-m);
    }

    .tb-quiz__score {
      font: var(--tb-type-title-s);
    }

    .tb-quiz-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-xs);
      background: var(--tb-list-item);
    }

    .tb-quiz-card--wrong {
      outline: 1px solid var(--p-md-error);
    }

    .tb-quiz-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-quiz-card__title {
      margin: 0;
      font: var(--p-md-title-medium, inherit);
    }

    .tb-quiz-card__verdict {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-quiz__field-label {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-quiz__line {
      overflow-wrap: anywhere;
    }

    .tb-quiz__line--muted {
      color: var(--p-md-on-surface-variant);
    }
  `,
})
export class QuizSection implements OnDestroy {
  protected readonly t = T.quizTake;
  private readonly api = inject(HomeworkApi);
  private readonly snackbar = inject(Snackbar);

  readonly taskId = input.required<string>();
  /** The assignment's title for the test's header. */
  readonly title = input('');

  /** `null` until loaded (and when the load failed: the page works without a quiz). */
  readonly view = signal<QuizView | null>(null);
  protected readonly answers = signal<Readonly<Record<string, QuizAnswer>>>({});
  /** The full-screen test is open. */
  readonly playing = signal(false);
  protected readonly pending = signal(false);
  private readonly dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The student has handed the quiz in or is in the middle of it: «Сдать» of the task needs no text. */
  readonly started = computed(() => {
    const quiz = this.view();
    return (
      quiz !== null &&
      quiz.questions.length > 0 &&
      (quiz.openAttempt !== null || quiz.attemptsUsed > 0)
    );
  });

  constructor() {
    effect(() => {
      this.taskId();
      untracked(() => {
        this.view.set(null);
        this.playing.set(false);
        this.reload();
      });
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    // the last typed answer is not lost on leaving the page
    void this.flush();
  }

  reload(): void {
    this.api.myQuiz(this.taskId()).subscribe({
      next: (quiz) => {
        this.show(quiz);
      },
      error: () => undefined,
    });
  }

  private show(quiz: QuizView): void {
    this.view.set(quiz);
    this.answers.set(quiz.openAttempt?.answers ?? {});
    this.dirty.clear();
  }

  protected start(): void {
    this.run(this.api.startQuizAttempt(this.taskId()), true);
  }

  /** «Завершить тест» of the player (it has asked already when questions were skipped). */
  protected async submit(attemptId: string): Promise<void> {
    if (!(await this.flush())) {
      return;
    }
    this.run(this.api.submitQuizAttempt(this.taskId(), attemptId), false);
  }

  private run(call: ReturnType<HomeworkApi['startQuizAttempt']>, play: boolean): void {
    this.pending.set(true);
    call.subscribe({
      next: (quiz) => {
        this.pending.set(false);
        this.show(quiz);
        this.playing.set(play && quiz.openAttempt !== null);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.snackbar.error(describeError(error, this.t.saveFailed));
      },
    });
  }

  /** Saves the answers changed since the last save; `false` when one could not be saved. */
  flush(): Promise<boolean> {
    clearTimeout(this.timer);
    // queued behind a save in flight, so submitting never overtakes the last answer
    const run = this.saving === null ? this.save() : this.saving.then(() => this.save());
    const tracked = run.finally(() => {
      if (this.saving === tracked) {
        this.saving = null;
      }
    });
    this.saving = tracked;
    return tracked;
  }

  private saving: Promise<boolean> | null = null;

  private async save(): Promise<boolean> {
    const attempt = this.view()?.openAttempt;
    if (!attempt) {
      return true;
    }
    const ids = [...this.dirty];
    this.dirty.clear();
    try {
      for (const id of ids) {
        const answer = this.answers()[id];
        if (answer !== undefined) {
          await firstValueFrom(this.api.saveQuizAnswer(this.taskId(), attempt.id, id, answer));
        }
      }
      return true;
    } catch (error) {
      ids.forEach((id) => this.dirty.add(id));
      this.snackbar.error(describeError(error, this.t.saveFailed));
      return false;
    }
  }

  /** An answer changed in the player: a click saves at once, typing after a pause. */
  protected edited(edit: QuizEdit): void {
    this.dirty.add(edit.question.id);
    clearTimeout(this.timer);
    if (edit.now) {
      void this.flush();
    } else {
      this.timer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
    }
  }

  /** When the right answers show; nothing once they are shown. */
  protected revealHint(quiz: QuizView): string {
    if (quiz.results !== null) {
      return '';
    }
    switch (quiz.reveal) {
      case 'AFTER_SUBMIT':
        return this.t.revealAfterSubmit;
      case 'AFTER_DUE':
        return this.t.revealAfterDue;
      case 'NEVER':
        return this.t.revealNever;
    }
  }

  protected mine(result: QuizResult): string[] {
    return answerLines(result.question, result.answer);
  }

  protected key(result: QuizResult): string[] {
    return keyLines(result.question);
  }
}
