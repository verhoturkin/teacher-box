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
 * attempts, when the key shows and «Начать тест» / «Продолжить тест» (while there is something to do); the
 * test itself opens full screen (`tb-quiz-player`) and its answers are saved as they change. After «Завершить
 * тест» the block «Тест · N из M» with the mistakes (the answer, the key, the explanation) when the teacher
 * allows it (sketch 24). Nothing without questions.
 */
@Component({
  selector: 'tb-quiz-section',
  imports: [Button, MarkdownView, QuizPlayer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as quiz) {
      @if (quiz.questions.length > 0) {
        <section class="tb-quiz">
          @if (quiz.openAttempt || quiz.canStart || !quiz.best) {
            <div class="tb-quiz__card">
              <h2 class="tb-quiz__title">
                <i class="tb-i tb-i-quiz" aria-hidden="true"></i>
                {{ t.cardTitle(quiz.questions.length) }}
              </h2>
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
          }
          @if (quiz.best; as best) {
            <div class="tb-quiz__result">
              <div class="tb-quiz__result-head">
                <h2 class="tb-quiz__label">
                  {{ t.resultTitle(best.scorePoints ?? 0, best.maxPoints ?? quiz.maxPoints) }}
                </h2>
                @if (quiz.results; as results) {
                  <span class="tb-quiz__muted">{{ t.mistakes(wrong(results).length) }}</span>
                }
              </div>
              @if (quiz.results; as results) {
                @for (result of wrong(results); track result.question.id) {
                  <article class="tb-quiz__mistake">
                    <i class="tb-i tb-i-cancel tb-quiz__mistake-icon" aria-hidden="true"></i>
                    <div class="tb-quiz__mistake-text">
                      <tb-markdown [text]="result.question.text" />
                      <p class="tb-quiz__muted">
                        {{ t.yourAnswer }}:
                        @if (mine(result).length > 0) {
                          <s>{{ mine(result).join(', ') }}</s>
                        } @else {
                          {{ t.noAnswer }}
                        }
                        · {{ t.correctAnswer }}:
                        <strong class="tb-quiz__right">{{ key(result).join(', ') }}</strong>
                      </p>
                      @if (result.question.explanation; as explanation) {
                        <tb-markdown class="tb-quiz__muted" [text]="explanation" />
                      }
                    </div>
                  </article>
                }
              } @else if (!quiz.openAttempt && !quiz.canStart) {
                <!-- otherwise the card above already says it -->
                <p class="tb-quiz__muted">{{ revealHint(quiz) }}</p>
              }
            </div>
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

    .tb-quiz__hint {
      margin: 0;
      font: var(--tb-type-body-m);
    }

    /* the result of sketch 24: a surface-container-low block, the mistakes as rows on the surface */
    .tb-quiz__result {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      padding: var(--tb-space-4) var(--tb-space-5);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-low);
    }

    .tb-quiz__result-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
    }

    .tb-quiz__label {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-quiz__muted {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-quiz__mistake {
      display: flex;
      align-items: flex-start;
      gap: var(--tb-space-3);
      padding: var(--tb-space-3);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-surface);
      overflow-wrap: anywhere;
    }

    .tb-quiz__mistake-icon {
      color: var(--p-md-error);
    }

    .tb-quiz__mistake-text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--tb-space-1);
      min-inline-size: 0;
    }

    .tb-quiz__right {
      color: var(--p-md-on-surface);
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

  protected wrong(results: readonly QuizResult[]): QuizResult[] {
    return results.filter((result) => !result.correct);
  }

  protected mine(result: QuizResult): string[] {
    return answerLines(result.question, result.answer);
  }

  protected key(result: QuizResult): string[] {
    return keyLines(result.question);
  }
}
