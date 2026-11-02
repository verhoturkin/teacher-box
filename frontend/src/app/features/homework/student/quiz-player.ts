import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { ProgressBar } from 'primeng/progressbar';
import { RadioButton } from 'primeng/radiobutton';
import { Select } from 'primeng/select';
import { injectMobile } from '@core/layout/mobile';
import { Confirm } from '@shared/ui/confirm';
import { DialogHeaderActions, TbDialog } from '@shared/ui/dialog/dialog';
import { MarkdownView } from '@shared/ui/markdown-view';
import { ProgressLabel } from '@shared/ui/progress-label.directive';
import { QuizAnswer, QuizItem, QuizQuestion } from '../data-access/homework.models';
import { T } from '../i18n/texts';

/** The student gave some answer to the question. */
export function isAnswered(answer: QuizAnswer | undefined): boolean {
  return (
    answer !== undefined &&
    ((answer.ids?.length ?? 0) > 0 ||
      (answer.text ?? '').trim() !== '' ||
      (answer.number !== null && answer.number !== undefined) ||
      Object.keys(answer.pairs ?? {}).length > 0)
  );
}

/** An answer changed: `now` — a click (save at once), else typing (save after a pause). */
export interface QuizEdit {
  readonly question: QuizQuestion;
  readonly now: boolean;
}

/**
 * The test over the task — a pane in the frame from medium, full screen on a phone (sketches 23, 26):
 * one question with large options, «Назад · Дальше», the question numbers (answered / current; dots on a phone), «Завершить тест» that asks only
 * when questions are skipped. It only shows and edits `answers`: the host saves them (the task) or
 * keeps them (the teacher's preview).
 */
@Component({
  selector: 'tb-quiz-player',
  imports: [
    FormsModule,
    Button,
    Checkbox,
    InputText,
    ProgressBar,
    ProgressLabel,
    RadioButton,
    Select,
    MarkdownView,
    TbDialog,
    DialogHeaderActions,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-dialog
      kind="screen"
      [(visible)]="visible"
      [headline]="title()"
      [closeLabel]="exitLabel()"
      [cancelLabel]="null"
    >
      <ng-template tbDialogHeaderActions>
        <span class="tb-qp__step" aria-live="polite">{{ t.step(step() + 1, total()) }}</span>
      </ng-template>
      @if (current(); as q) {
        <div class="tb-qp">
          <p class="tb-qp__muted tb-qp__subtitle">{{ subtitle() }}</p>
          <p-progressbar
            styleClass="tb-qp__progress"
            [value]="progress()"
            [showValue]="false"
            [tbProgressLabel]="t.progress(answeredCount(), total())"
          />
          <div class="tb-qp__body">
            <section class="tb-qp__question" [attr.aria-label]="t.question(step() + 1)">
              <p class="tb-qp__muted">{{ kinds[q.type] }} · {{ t.points(q.points) }}</p>
              <tb-markdown class="tb-qp__text" [text]="q.text" />
              @switch (q.type) {
                @case ('SINGLE_CHOICE') {
                  <div class="tb-qp__options" role="radiogroup" [attr.aria-label]="t.single">
                    @for (option of q.options; track option.id) {
                      <label class="tb-qp__option" [for]="'o-' + option.id">
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
                  <div class="tb-qp__options" role="group" [attr.aria-label]="t.multiple">
                    @for (option of q.options; track option.id) {
                      <label class="tb-qp__option" [for]="'o-' + option.id">
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
                    class="tb-qp__input"
                    type="text"
                    maxlength="200"
                    autocomplete="off"
                    [attr.aria-label]="t.answerText"
                    [placeholder]="t.answerText"
                    [value]="answers()[q.id]?.text ?? ''"
                    (input)="setText(q, valueOf($event))"
                    (blur)="settle.emit()"
                  />
                }
                @case ('NUMBER') {
                  <input
                    pInputText
                    class="tb-qp__input"
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    [attr.aria-label]="t.answerNumber"
                    [placeholder]="t.answerNumber"
                    [value]="answers()[q.id]?.number ?? ''"
                    (input)="setNumber(q, valueOf($event))"
                    (blur)="settle.emit()"
                  />
                }
                @case ('MATCHING') {
                  <div class="tb-qp__pairs">
                    @for (left of q.left; track left.id) {
                      <div class="tb-qp__pair">
                        <span class="tb-qp__pair-left">{{ left.text }}</span>
                        <p-select
                          [options]="rights().get(q.id)"
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
                  <p class="tb-qp__muted">{{ t.orderHint }}</p>
                  <ol class="tb-qp__order">
                    @for (item of ordered(q); track item.id; let i = $index; let last = $last) {
                      <li class="tb-qp__order-item">
                        <span class="tb-qp__order-text">{{ item.text }}</span>
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
              <div class="tb-qp__dots" aria-hidden="true">
                @for (other of questions(); track other.id; let n = $index) {
                  <span
                    class="tb-qp__dot"
                    [class.tb-qp__dot--done]="answered(other)"
                    [class.tb-qp__dot--current]="n === step()"
                  ></span>
                }
              </div>
              <div class="tb-qp__nav">
                @if (mobile()) {
                  <p-button
                    icon="tb-i tb-i-arrow_back"
                    severity="secondary"
                    [rounded]="true"
                    [ariaLabel]="t.prev"
                    [disabled]="step() === 0"
                    (onClick)="go(step() - 1)"
                  />
                } @else {
                  <p-button
                    [label]="t.prev"
                    icon="tb-i tb-i-arrow_back"
                    [text]="true"
                    [disabled]="step() === 0"
                    (onClick)="go(step() - 1)"
                  />
                }
                <span class="tb-qp__spacer"></span>
                @if (step() < total() - 1) {
                  <p-button
                    [label]="t.next"
                    icon="tb-i tb-i-arrow_forward"
                    iconPos="right"
                    (onClick)="go(step() + 1)"
                  />
                } @else {
                  <p-button [label]="t.finish" [loading]="pending()" (onClick)="end()" />
                }
              </div>
            </section>

            <aside class="tb-qp__side" [attr.aria-label]="t.questions">
              <span class="tb-qp__label">{{ t.questions }}</span>
              <div class="tb-qp__map">
                @for (other of questions(); track other.id; let n = $index) {
                  <button
                    type="button"
                    class="tb-qp__number"
                    [class.tb-qp__number--done]="answered(other)"
                    [class.tb-qp__number--current]="n === step()"
                    [attr.aria-current]="n === step() ? 'step' : null"
                    [attr.aria-label]="t.numberLabel(n + 1, answered(other))"
                    (click)="go(n)"
                  >
                    {{ n + 1 }}
                  </button>
                }
              </div>
              <p-button
                [label]="t.finish"
                severity="secondary"
                [loading]="pending()"
                (onClick)="end()"
              />
              @if (hint(); as text) {
                <p class="tb-qp__muted">{{ text }}</p>
              }
            </aside>
          </div>
        </div>
      }
    </tb-dialog>
  `,
  styles: `
    /*
     * ours (sketches 23, 26): the question column ≤ 45 rem and the 15 rem column of numbers beside it, centred;
     * options are 16 dp cards on surface-container-low, the chosen one secondary-container with a 2 dp
     * primary border; numbers are 40 dp squares (12 dp corners): answered secondary-container, current
     * primary, the rest outlined; on compact dots replace the numbers and the 56 dp buttons sit at the bottom
     */
    .tb-qp {
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: var(--tb-space-4);
    }

    .tb-qp__subtitle {
      margin-block-start: calc(-1 * var(--tb-space-2));
    }

    :host ::ng-deep .tb-qp__progress {
      height: 4px;
    }

    .tb-qp__body {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      gap: var(--tb-space-8);
      justify-content: center;
    }

    .tb-qp__question {
      display: flex;
      flex: 1 1 35rem;
      flex-direction: column;
      gap: var(--tb-space-5);
      max-inline-size: 45rem;
      min-inline-size: 0;
    }

    .tb-qp__text {
      font: var(--tb-type-headline-s);
    }

    .tb-qp__muted,
    .tb-qp__step {
      margin: 0;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-m);
    }

    .tb-qp__options,
    .tb-qp__pairs,
    .tb-qp__order {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-2);
    }

    .tb-qp__option {
      display: flex;
      align-items: center;
      gap: var(--tb-space-4);
      padding: var(--tb-space-4) var(--tb-space-5);
      border: 2px solid transparent;
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-low);
      font: var(--tb-type-body-l);
      cursor: pointer;
      overflow-wrap: anywhere;
    }

    .tb-qp__option:has(input:checked) {
      border-color: var(--p-md-primary);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-qp__option:has(input:focus-visible) {
      outline: 2px solid var(--p-md-primary);
      outline-offset: 2px;
    }

    .tb-qp__input {
      width: 100%;
    }

    .tb-qp__pair {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-1);
    }

    .tb-qp__pair-left {
      overflow-wrap: anywhere;
    }

    .tb-qp__order {
      margin: 0;
      padding: 0;
      list-style: none;
      counter-reset: item;
    }

    .tb-qp__order-item {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      padding-inline-start: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-low);
      counter-increment: item;
    }

    .tb-qp__order-item::before {
      content: counter(item) '.';
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
    }

    .tb-qp__order-text {
      flex: 1 1 auto;
      min-width: 0;
      padding-block: var(--tb-space-3);
      font: var(--tb-type-body-l);
      overflow-wrap: anywhere;
    }

    .tb-qp__nav {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      margin-block-start: var(--tb-space-2);
    }

    .tb-qp__spacer {
      flex: 1;
    }

    .tb-qp__side {
      display: flex;
      flex: 0 0 15rem;
      flex-direction: column;
      gap: var(--tb-space-3);
    }

    .tb-qp__label {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-qp__map {
      display: grid;
      grid-template-columns: repeat(5, 2.5rem);
      gap: var(--tb-space-2);
      margin-block-end: var(--tb-space-3);
    }

    .tb-qp__number {
      inline-size: 2.5rem;
      block-size: 2.5rem;
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-md);
      background: transparent;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-l);
      cursor: pointer;
    }

    .tb-qp__number--done {
      border-color: transparent;
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-qp__number--current {
      border-color: transparent;
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);
    }

    .tb-qp__dots {
      display: none;
    }

    @media (width >= 37.5em) {
      .tb-qp__pair {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        align-items: center;
        gap: var(--tb-space-3);
      }
    }

    @media (width < 37.5em) {
      .tb-qp__side {
        display: none;
      }

      .tb-qp__question {
        flex-basis: 100%;
      }

      /* the dots and the buttons at the bottom of the screen */
      .tb-qp__dots {
        display: flex;
        gap: 6px;
        justify-content: center;
        margin-block-start: auto;
      }

      .tb-qp__dot {
        inline-size: 8px;
        block-size: 8px;
        border-radius: 4px;
        background: var(--p-md-outline-variant);
      }

      .tb-qp__dot--done {
        background: var(--p-md-secondary-container);
      }

      .tb-qp__dot--current {
        inline-size: 20px;
        background: var(--p-md-primary);
      }

      .tb-qp__nav ::ng-deep .p-button {
        min-block-size: 3.5rem;
      }

      .tb-qp__nav ::ng-deep .p-button-icon-only {
        inline-size: 3.5rem;
      }

      .tb-qp__spacer {
        display: none;
      }

      .tb-qp__nav > p-button:last-child {
        flex: 1;
      }

      .tb-qp__nav > p-button:last-child ::ng-deep .p-button {
        inline-size: 100%;
      }
    }
  `,
})
export class QuizPlayer {
  protected readonly t = T.quizTake;
  protected readonly kinds = T.quiz.types;
  private readonly confirm = inject(Confirm);
  protected readonly mobile = injectMobile();

  readonly visible = model(false);
  readonly questions = input.required<readonly QuizQuestion[]>();
  readonly answers = model.required<Readonly<Record<string, QuizAnswer>>>();
  /** «Тест · <задание>». */
  readonly title = input.required<string>();
  /** «Попытка 1 из 2 · ответы сохраняются сами». */
  readonly subtitle = input.required<string>();
  /** Under «Завершить тест»: when the right answers show. */
  readonly hint = input<string | null>(null);
  readonly exitLabel = input(T.quizTake.exit);
  readonly pending = input(false);

  /** An answer changed. */
  readonly edited = output<QuizEdit>();
  /** A moment to save what is typed: the field lost focus, another question opened. */
  readonly settle = output();
  /** «Завершить тест», confirmed when questions were skipped. */
  readonly finished = output();

  protected readonly step = signal(0);
  protected readonly total = computed(() => this.questions().length);
  protected readonly current = computed(() => this.questions()[this.step()]);
  protected readonly answeredCount = computed(
    () => this.questions().filter((q) => this.answered(q)).length,
  );
  /** The right column of each matching as the mutable array the select wants. */
  protected readonly rights = computed(
    () => new Map(this.questions().map((q): [string, QuizItem[]] => [q.id, [...q.right]])),
  );
  protected readonly progress = computed(() =>
    Math.round((100 * this.answeredCount()) / Math.max(this.total(), 1)),
  );

  constructor() {
    // every opening starts at the first unanswered question
    effect(() => {
      if (this.visible()) {
        untracked(() => {
          const first = this.questions().findIndex((q) => !this.answered(q));
          this.step.set(Math.max(first, 0));
        });
      }
    });
  }

  /** An ordering is answered after the first move: the shuffled order the server shows is not an answer. */
  protected answered(question: QuizQuestion): boolean {
    return isAnswered(this.answers()[question.id]);
  }

  protected go(step: number): void {
    this.settle.emit();
    this.step.set(step);
  }

  protected async end(): Promise<void> {
    const skipped = this.total() - this.answeredCount();
    if (
      skipped > 0 &&
      !(await this.confirm.safe({
        header: this.t.confirmHeader,
        message: this.t.confirmMessage(skipped),
        acceptLabel: this.t.confirmAccept,
      }))
    ) {
      return;
    }
    this.finished.emit();
  }

  private set(question: QuizQuestion, answer: QuizAnswer, now: boolean): void {
    this.answers.update((all) => ({ ...all, [question.id]: answer }));
    this.edited.emit({ question, now });
  }

  protected ids(question: QuizQuestion): readonly string[] {
    return this.answers()[question.id]?.ids ?? [];
  }

  protected setIds(question: QuizQuestion, ids: readonly string[]): void {
    this.set(question, { ids }, true);
  }

  protected toggle(question: QuizQuestion, id: string, checked: boolean): void {
    const rest = this.ids(question).filter((other) => other !== id);
    this.setIds(question, checked ? [...rest, id] : rest);
  }

  protected setText(question: QuizQuestion, text: string): void {
    this.set(question, { text }, false);
  }

  protected setNumber(question: QuizQuestion, raw: string): void {
    const value = Number(raw.trim().replace(',', '.'));
    if (raw.trim() !== '' && Number.isFinite(value)) {
      this.set(question, { number: value }, false);
    }
  }

  setPair(question: QuizQuestion, left: string, right: string): void {
    this.set(question, { pairs: { ...this.answers()[question.id]?.pairs, [left]: right } }, true);
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

  protected valueOf(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }
}
