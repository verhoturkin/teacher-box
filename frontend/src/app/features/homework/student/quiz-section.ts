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
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { RadioButton } from 'primeng/radiobutton';
import { Select } from 'primeng/select';
import { firstValueFrom } from 'rxjs';
import { describeError } from '@core/http/error-messages';
import { injectMobile } from '@core/layout/mobile';
import { Snackbar } from '@core/snackbar/snackbar';
import { Confirm } from '@shared/ui/confirm';
import { MarkdownView } from '@shared/ui/markdown-view';
import { HomeworkApi } from '../data-access/homework-api';
import {
  Question,
  QuizAnswer,
  QuizQuestion,
  QuizResult,
  QuizView,
} from '../data-access/homework.models';
import { T } from '../i18n/texts';

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
 * Student: the quiz of a task (ADR-0052) — one question per screen on a phone, the list on a wide screen;
 * answers are saved as they change, «Сдать тест» asks for confirmation; then the score, the key when the teacher
 * allows it, and a new attempt while there are some left. The page asks for nothing when there are no questions.
 */
@Component({
  selector: 'tb-quiz-section',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    Button,
    Checkbox,
    InputText,
    RadioButton,
    Select,
    MarkdownView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as quiz) {
      @if (quiz.questions.length > 0) {
        <section class="tb-quiz">
          <h2 class="tb-quiz__label">{{ t.title }}</h2>

          @if (quiz.openAttempt; as attempt) {
            @if (mobile()) {
              <p class="tb-quiz__step" aria-live="polite">
                {{ t.step(step() + 1, quiz.questions.length) }}
              </p>
              <ng-container
                [ngTemplateOutlet]="questionTpl"
                [ngTemplateOutletContext]="{ q: quiz.questions[step()], n: step() }"
              />
              <div class="tb-quiz__nav">
                <p-button
                  [label]="t.prev"
                  severity="secondary"
                  [text]="true"
                  [disabled]="step() === 0"
                  (onClick)="go(-1)"
                />
                @if (step() < quiz.questions.length - 1) {
                  <p-button [label]="t.next" (onClick)="go(1)" />
                } @else {
                  <p-button
                    [label]="t.finish"
                    [loading]="pending()"
                    (onClick)="submit(attempt.id)"
                  />
                }
              </div>
            } @else {
              @for (q of quiz.questions; track q.id; let n = $index) {
                <ng-container
                  [ngTemplateOutlet]="questionTpl"
                  [ngTemplateOutletContext]="{ q: q, n: n }"
                />
              }
              <div class="tb-form-actions">
                <p-button [label]="t.submit" [loading]="pending()" (onClick)="submit(attempt.id)" />
              </div>
            }
            <p class="tb-quiz__hint">{{ t.saved }}</p>
          } @else {
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
              }}
            </p>
            @if (quiz.best && quiz.results === null) {
              <p class="tb-quiz__hint">
                {{ quiz.reveal === 'NEVER' ? t.revealNever : t.revealAfterDue }}
              </p>
            }
            @if (quiz.canStart) {
              <div class="tb-form-actions">
                <p-button
                  [label]="quiz.attemptsUsed === 0 ? t.start : t.newAttempt"
                  [loading]="pending()"
                  (onClick)="start()"
                />
              </div>
            }
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
          }
        </section>
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

    <ng-template #questionTpl let-q="q" let-n="n">
      <article class="tb-quiz-card">
        <header class="tb-quiz-card__head">
          <h3 class="tb-quiz-card__title">{{ t.question(n + 1) }}</h3>
          <span class="tb-quiz-card__points">{{ t.points(q.points) }}</span>
        </header>
        <tb-markdown [text]="q.text" />
        @switch (q.type) {
          @case ('SINGLE_CHOICE') {
            <div class="tb-quiz-options" role="radiogroup" [attr.aria-label]="t.single">
              @for (option of q.options; track option.id) {
                <label class="tb-quiz-option" [for]="'o-' + option.id">
                  <p-radiobutton
                    [name]="'q-' + q.id"
                    [value]="option.id"
                    [inputId]="'o-' + option.id"
                    [ngModel]="ids(q)[0]"
                    (ngModelChange)="setIds(q, [$event])"
                  />
                  <span>{{ option.text }}</span>
                </label>
              }
            </div>
          }
          @case ('MULTIPLE_CHOICE') {
            <div class="tb-quiz-options" role="group" [attr.aria-label]="t.multiple">
              @for (option of q.options; track option.id) {
                <label class="tb-quiz-option" [for]="'o-' + option.id">
                  <p-checkbox
                    [binary]="true"
                    [inputId]="'o-' + option.id"
                    [ngModel]="ids(q).includes(option.id)"
                    (ngModelChange)="toggle(q, option.id, $event)"
                  />
                  <span>{{ option.text }}</span>
                </label>
              }
            </div>
          }
          @case ('SHORT_TEXT') {
            <input
              pInputText
              class="tb-quiz-input"
              type="text"
              maxlength="200"
              autocomplete="off"
              [attr.aria-label]="t.answerText"
              [placeholder]="t.answerText"
              [value]="answers()[q.id]?.text ?? ''"
              (input)="setText(q, valueOf($event))"
              (blur)="flush()"
            />
          }
          @case ('NUMBER') {
            <input
              pInputText
              class="tb-quiz-input"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              [attr.aria-label]="t.answerNumber"
              [placeholder]="t.answerNumber"
              [value]="answers()[q.id]?.number ?? ''"
              (input)="setNumber(q, valueOf($event))"
              (blur)="flush()"
            />
          }
          @case ('MATCHING') {
            <div class="tb-quiz-pairs">
              @for (left of q.left; track left.id) {
                <div class="tb-quiz-pair">
                  <span class="tb-quiz-pair__left">{{ left.text }}</span>
                  <p-select
                    [options]="q.right"
                    optionLabel="text"
                    optionValue="id"
                    appendTo="body"
                    [fluid]="true"
                    [placeholder]="t.pairChoose"
                    [ariaLabel]="t.pairFor(left.text)"
                    [ngModel]="answers()[q.id]?.pairs?.[left.id] ?? null"
                    (ngModelChange)="setPair(q, left.id, $event)"
                  />
                </div>
              }
            </div>
          }
          @case ('ORDERING') {
            <p class="tb-quiz__hint">{{ t.orderHint }}</p>
            <ol class="tb-quiz-order">
              @for (item of ordered(q); track item.id; let i = $index; let last = $last) {
                <li class="tb-quiz-order__item">
                  <span class="tb-quiz-order__text">{{ item.text }}</span>
                  <p-button
                    icon="tb-i tb-i-expand_less"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="i === 0"
                    [ariaLabel]="t.moveUp(i + 1, item.text)"
                    (onClick)="move(q, i, -1)"
                  />
                  <p-button
                    icon="tb-i tb-i-expand_more"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="last"
                    [ariaLabel]="t.moveDown(i + 1, item.text)"
                    (onClick)="move(q, i, 1)"
                  />
                </li>
              }
            </ol>
          }
        }
      </article>
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

    .tb-quiz__label {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-quiz__step,
    .tb-quiz__hint,
    .tb-quiz__score {
      margin: 0;
    }

    .tb-quiz__step,
    .tb-quiz__hint {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-quiz__score {
      font: var(--p-md-title-medium, inherit);
    }

    .tb-quiz__nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
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

    .tb-quiz-card__points,
    .tb-quiz-card__verdict {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-quiz-card__verdict {
      display: inline-flex;
      align-items: center;
      gap: var(--tb-space-1);
    }

    .tb-quiz-options,
    .tb-quiz-pairs {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-1);
    }

    .tb-quiz-option {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      min-height: 3rem;
      cursor: pointer;
      overflow-wrap: anywhere;
    }

    .tb-quiz-input {
      width: 100%;
    }

    .tb-quiz-pair {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-1);
      padding-block: var(--tb-space-1);
    }

    .tb-quiz-pair__left {
      overflow-wrap: anywhere;
    }

    .tb-quiz-order {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: item;
    }

    .tb-quiz-order__item {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      padding-inline-start: var(--tb-space-3);
      border-radius: var(--tb-shape-xs);
      background: var(--p-md-surface-container-high, transparent);
      counter-increment: item;
    }

    .tb-quiz-order__item::before {
      content: counter(item) '.';
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-quiz-order__text {
      flex: 1 1 auto;
      min-width: 0;
      padding-block: var(--tb-space-2);
      overflow-wrap: anywhere;
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

    @media (width >= 37.5em) {
      .tb-quiz-pair {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        align-items: center;
        gap: var(--tb-space-3);
      }
    }
  `,
})
export class QuizSection implements OnDestroy {
  protected readonly t = T.quizTake;
  private readonly api = inject(HomeworkApi);
  private readonly snackbar = inject(Snackbar);
  private readonly confirm = inject(Confirm);

  readonly taskId = input.required<string>();

  /** `null` until loaded (and when the load failed: the page works without a quiz). */
  readonly view = signal<QuizView | null>(null);
  protected readonly answers = signal<Readonly<Record<string, QuizAnswer>>>({});
  protected readonly step = signal(0);
  protected readonly pending = signal(false);
  protected readonly mobile = injectMobile();
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
    this.step.set(0);
    this.dirty.clear();
  }

  protected start(): void {
    this.run(this.api.startQuizAttempt(this.taskId()));
  }

  protected async submit(attemptId: string): Promise<void> {
    const unanswered = (this.view()?.questions ?? []).filter((q) => !this.answered(q)).length;
    const sure = await this.confirm.safe({
      header: this.t.confirmHeader,
      message: this.t.confirmMessage(unanswered),
      acceptLabel: this.t.confirmAccept,
    });
    if (!sure || !(await this.flush())) {
      return;
    }
    this.run(this.api.submitQuizAttempt(this.taskId(), attemptId));
  }

  private run(call: ReturnType<HomeworkApi['startQuizAttempt']>): void {
    this.pending.set(true);
    call.subscribe({
      next: (quiz) => {
        this.pending.set(false);
        this.show(quiz);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.snackbar.error(describeError(error, this.t.saveFailed));
      },
    });
  }

  protected go(delta: number): void {
    void this.flush();
    this.step.update((step) => step + delta);
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

  private set(question: QuizQuestion, answer: QuizAnswer, delay = SAVE_DELAY_MS): void {
    this.answers.update((all) => ({ ...all, [question.id]: answer }));
    this.dirty.add(question.id);
    clearTimeout(this.timer);
    if (delay === 0) {
      void this.flush();
    } else {
      this.timer = setTimeout(() => void this.flush(), delay);
    }
  }

  protected ids(question: QuizQuestion): readonly string[] {
    return this.answers()[question.id]?.ids ?? [];
  }

  protected setIds(question: QuizQuestion, ids: readonly string[]): void {
    this.set(question, { ids }, 0);
  }

  protected toggle(question: QuizQuestion, id: string, checked: boolean): void {
    const rest = this.ids(question).filter((other) => other !== id);
    this.setIds(question, checked ? [...rest, id] : rest);
  }

  protected setText(question: QuizQuestion, text: string): void {
    this.set(question, { text });
  }

  protected setNumber(question: QuizQuestion, raw: string): void {
    const value = Number(raw.trim().replace(',', '.'));
    if (raw.trim() !== '' && Number.isFinite(value)) {
      this.set(question, { number: value });
    }
  }

  setPair(question: QuizQuestion, left: string, right: string): void {
    this.set(question, { pairs: { ...this.answers()[question.id]?.pairs, [left]: right } }, 0);
  }

  /** The items of an ordering in the student's order; the shuffled order of the server until the first move. */
  protected ordered(question: QuizQuestion): readonly { id: string; text: string }[] {
    const saved = this.answers()[question.id]?.ids ?? [];
    const byId = new Map(question.options.map((item) => [item.id, item]));
    const known = saved.flatMap((id) => byId.get(id) ?? []);
    return known.length === question.options.length ? known : [...question.options];
  }

  protected move(question: QuizQuestion, index: number, delta: number): void {
    const items = this.ordered(question).map((item) => item.id);
    const moved = items.splice(index, 1);
    items.splice(index + delta, 0, ...moved);
    this.setIds(question, items);
  }

  private answered(question: QuizQuestion): boolean {
    const answer = this.answers()[question.id];
    if (!answer) {
      return false;
    }
    return (
      (answer.ids?.length ?? 0) > 0 ||
      (answer.text ?? '').trim() !== '' ||
      (answer.number !== null && answer.number !== undefined) ||
      Object.keys(answer.pairs ?? {}).length > 0
    );
  }

  protected valueOf(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  protected mine(result: QuizResult): string[] {
    return answerLines(result.question, result.answer);
  }

  protected key(result: QuizResult): string[] {
    return keyLines(result.question);
  }
}
