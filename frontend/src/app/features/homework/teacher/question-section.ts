import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { RadioButton } from 'primeng/radiobutton';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Question, QuestionType, QuizReveal } from '../data-access/homework.models';
import { T } from '../i18n/texts';

/** An option, an item of an ordering, being written in the editor. */
export interface OptionDraft {
  readonly id: string;
  readonly text: string;
  /** A right choice; unused by an ordering. */
  readonly correct: boolean;
}

/** A pair of a matching being written in the editor. */
export interface PairDraft {
  readonly id: string;
  readonly left: string;
  readonly right: string;
}

/** A question being written in the editor; the fields of other types stay empty. */
export interface QuestionDraft {
  readonly id: string;
  readonly type: QuestionType;
  readonly text: string;
  readonly points: number;
  readonly explanation: string;
  readonly options: readonly OptionDraft[];
  readonly accepted: readonly string[];
  readonly value: number | null;
  readonly tolerance: number | null;
  readonly pairs: readonly PairDraft[];
}

/** The limits of the backend (`Quiz`, `Question`, `ShortText`). */
export const MAX_QUESTIONS = 50;
export const MAX_ITEMS = 10;
export const MAX_ACCEPTED = 10;
const MIN_ITEMS = 2;
const MAX_POINTS = 100;

export const QUESTION_TYPES: readonly QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'SHORT_TEXT',
  'NUMBER',
  'MATCHING',
  'ORDERING',
];

const REVEALS: readonly QuizReveal[] = ['AFTER_SUBMIT', 'AFTER_DUE', 'NEVER'];
const ATTEMPTS = [1, 2, 3, 5, 10, 0];

function newId(): string {
  return crypto.randomUUID();
}

function option(text = '', correct = false): OptionDraft {
  return { id: newId(), text, correct };
}

function pair(): PairDraft {
  return { id: newId(), left: '', right: '' };
}

/** A new question of the type, with the blanks it needs, or the draft of a saved one. */
export function questionDraft(type: QuestionType, saved?: Question): QuestionDraft {
  if (saved !== undefined) {
    return {
      id: saved.id,
      type: saved.type,
      text: saved.text,
      points: saved.points,
      explanation: saved.explanation ?? '',
      options: saved.options.map((item) => ({
        id: item.id,
        text: item.text,
        correct: saved.correct.includes(item.id),
      })),
      accepted: saved.accepted,
      value: saved.value,
      tolerance: saved.tolerance,
      pairs: saved.pairs,
    };
  }
  const choice = type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
  return {
    id: newId(),
    type,
    text: '',
    points: 1,
    explanation: '',
    options: choice || type === 'ORDERING' ? [option('', type === 'SINGLE_CHOICE'), option()] : [],
    accepted: type === 'SHORT_TEXT' ? [''] : [],
    value: null,
    tolerance: type === 'NUMBER' ? 0 : null,
    pairs: type === 'MATCHING' ? [pair(), pair()] : [],
  };
}

/** The questions to save, trimmed, with only the fields of their type. */
export function questionInputs(drafts: readonly QuestionDraft[]): Question[] {
  return drafts.map((draft) => {
    const choice = draft.type === 'SINGLE_CHOICE' || draft.type === 'MULTIPLE_CHOICE';
    const options =
      choice || draft.type === 'ORDERING'
        ? draft.options.map((item) => ({ id: item.id, text: item.text.trim() }))
        : [];
    return {
      id: draft.id,
      type: draft.type,
      text: draft.text.trim(),
      points: draft.points,
      explanation: draft.explanation.trim() === '' ? null : draft.explanation.trim(),
      options,
      correct: choice ? draft.options.filter((item) => item.correct).map((item) => item.id) : [],
      accepted:
        draft.type === 'SHORT_TEXT'
          ? draft.accepted.map((answer) => answer.trim()).filter((answer) => answer !== '')
          : [],
      value: draft.type === 'NUMBER' ? draft.value : null,
      tolerance: draft.type === 'NUMBER' ? (draft.tolerance ?? 0) : null,
      pairs:
        draft.type === 'MATCHING'
          ? draft.pairs.map((item) => ({
              id: item.id,
              left: item.left.trim(),
              right: item.right.trim(),
            }))
          : [],
    };
  });
}

/** What is wrong with the question, in words, or `null`. */
export function questionProblem(draft: QuestionDraft): string | null {
  const p = T.quiz.problems;
  if (draft.text.trim() === '') {
    return p.text;
  }
  if (draft.points < 1 || draft.points > MAX_POINTS) {
    return p.points;
  }
  const filled = draft.options.filter((item) => item.text.trim() !== '');
  const marked = draft.options.filter((item) => item.correct).length;
  switch (draft.type) {
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      if (filled.length < MIN_ITEMS || filled.length !== draft.options.length) {
        return p.options;
      }
      if (draft.type === 'SINGLE_CHOICE' ? marked !== 1 : marked === 0) {
        return draft.type === 'SINGLE_CHOICE' ? p.correct : p.correctMany;
      }
      return null;
    case 'ORDERING':
      return filled.length < MIN_ITEMS || filled.length !== draft.options.length ? p.items : null;
    case 'SHORT_TEXT':
      return draft.accepted.some((answer) => answer.trim() !== '') ? null : p.accepted;
    case 'NUMBER':
      if (draft.value === null) {
        return p.value;
      }
      return (draft.tolerance ?? 0) < 0 ? p.tolerance : null;
    case 'MATCHING':
      return draft.pairs.length >= MIN_ITEMS &&
        draft.pairs.every((item) => item.left.trim() !== '' && item.right.trim() !== '')
        ? null
        : p.pairs;
  }
}

/** The first question that cannot be saved; `null` — all are fine. */
export function firstProblem(drafts: readonly QuestionDraft[]): string | null {
  for (const draft of drafts) {
    const problem = questionProblem(draft);
    if (problem !== null) {
      return problem;
    }
  }
  return null;
}

/**
 * The «Вопросы» section of the assignment editor (ADR-0052): a card per question — the text, the answer fields of its
 * type, the points and the explanation, in the order the student gets them — then how the quiz goes (when the correct
 * answers show, how many attempts). Once a student started the quiz the questions are read-only.
 */
@Component({
  selector: 'tb-question-section',
  imports: [FormsModule, Button, Checkbox, InputNumber, InputText, RadioButton, Textarea],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <small class="tb-hint">{{ t.hint }}</small>
    @if (locked()) {
      <p class="tb-question-note" role="status">{{ t.locked }}</p>
    }
    @if (error(); as message) {
      <p class="tb-field__error" role="alert">{{ message }}</p>
    }
    @for (
      draft of questions();
      track draft.id;
      let index = $index;
      let first = $first, last = $last
    ) {
      <section
        class="tb-question-card"
        [attr.aria-label]="t.question(index + 1, t.types[draft.type])"
      >
        <div class="tb-question-card__head">
          <h3 class="tb-question-card__title">{{ t.question(index + 1, t.types[draft.type]) }}</h3>
          @if (!locked()) {
            <div class="tb-question-card__actions">
              <p-button
                icon="tb-i tb-i-expand_less"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [disabled]="first"
                [ariaLabel]="t.moveUp(index + 1)"
                (onClick)="move(draft.id, -1)"
              />
              <p-button
                icon="tb-i tb-i-expand_more"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [disabled]="last"
                [ariaLabel]="t.moveDown(index + 1)"
                (onClick)="move(draft.id, 1)"
              />
              <p-button
                icon="tb-i tb-i-delete"
                [text]="true"
                [rounded]="true"
                severity="danger"
                [ariaLabel]="t.remove(index + 1)"
                (onClick)="remove(draft.id)"
              />
            </div>
          }
        </div>

        <div class="tb-field">
          <label [for]="'question-text-' + draft.id">{{ t.text }}</label>
          <textarea
            pTextarea
            [id]="'question-text-' + draft.id"
            rows="3"
            maxlength="2000"
            [disabled]="locked()"
            [ngModel]="draft.text"
            (ngModelChange)="change(draft.id, { text: $event })"
          ></textarea>
        </div>

        <small class="tb-hint">{{ t.typeHints[draft.type] }}</small>

        @switch (draft.type) {
          @case ('SINGLE_CHOICE') {
            @for (item of draft.options; track item.id; let n = $index) {
              <div class="tb-question-row">
                <p-radiobutton
                  [name]="'correct-' + draft.id"
                  [value]="item.id"
                  [ngModel]="correctId(draft)"
                  (ngModelChange)="pick(draft.id, $event)"
                  [disabled]="locked()"
                  [inputId]="'correct-' + item.id"
                  [ariaLabel]="t.correct(t.option(n + 1))"
                />
                <input
                  pInputText
                  class="tb-question-row__field"
                  maxlength="2000"
                  autocomplete="off"
                  [disabled]="locked()"
                  [attr.aria-label]="t.option(n + 1)"
                  [ngModel]="item.text"
                  (ngModelChange)="changeOption(draft.id, item.id, { text: $event })"
                />
                @if (!locked()) {
                  <p-button
                    icon="tb-i tb-i-close"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="draft.options.length <= minItems"
                    [ariaLabel]="t.removeOption(n + 1)"
                    (onClick)="removeOption(draft.id, item.id)"
                  />
                }
              </div>
            }
            @if (!locked() && draft.options.length < maxItems) {
              <p-button
                class="tb-question-add"
                [label]="t.addOption"
                icon="tb-i tb-i-add"
                [text]="true"
                (onClick)="addOption(draft.id)"
              />
            }
          }
          @case ('MULTIPLE_CHOICE') {
            @for (item of draft.options; track item.id; let n = $index) {
              <div class="tb-question-row">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="item.correct"
                  (ngModelChange)="changeOption(draft.id, item.id, { correct: $event })"
                  [disabled]="locked()"
                  [inputId]="'correct-' + item.id"
                  [ariaLabel]="t.correct(t.option(n + 1))"
                />
                <input
                  pInputText
                  class="tb-question-row__field"
                  maxlength="2000"
                  autocomplete="off"
                  [disabled]="locked()"
                  [attr.aria-label]="t.option(n + 1)"
                  [ngModel]="item.text"
                  (ngModelChange)="changeOption(draft.id, item.id, { text: $event })"
                />
                @if (!locked()) {
                  <p-button
                    icon="tb-i tb-i-close"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="draft.options.length <= minItems"
                    [ariaLabel]="t.removeOption(n + 1)"
                    (onClick)="removeOption(draft.id, item.id)"
                  />
                }
              </div>
            }
            @if (!locked() && draft.options.length < maxItems) {
              <p-button
                class="tb-question-add"
                [label]="t.addOption"
                icon="tb-i tb-i-add"
                [text]="true"
                (onClick)="addOption(draft.id)"
              />
            }
          }
          @case ('ORDERING') {
            @for (
              item of draft.options;
              track item.id;
              let n = $index;
              let top = $first, bottom = $last
            ) {
              <div class="tb-question-row">
                <span class="tb-question-row__number" aria-hidden="true">{{ n + 1 }}</span>
                <input
                  pInputText
                  class="tb-question-row__field"
                  maxlength="2000"
                  autocomplete="off"
                  [disabled]="locked()"
                  [attr.aria-label]="t.item(n + 1)"
                  [ngModel]="item.text"
                  (ngModelChange)="changeOption(draft.id, item.id, { text: $event })"
                />
                @if (!locked()) {
                  <p-button
                    icon="tb-i tb-i-expand_less"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="top"
                    [ariaLabel]="t.moveItemUp(n + 1)"
                    (onClick)="moveOption(draft.id, item.id, -1)"
                  />
                  <p-button
                    icon="tb-i tb-i-expand_more"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="bottom"
                    [ariaLabel]="t.moveItemDown(n + 1)"
                    (onClick)="moveOption(draft.id, item.id, 1)"
                  />
                  <p-button
                    icon="tb-i tb-i-close"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="draft.options.length <= minItems"
                    [ariaLabel]="t.removeItem(n + 1)"
                    (onClick)="removeOption(draft.id, item.id)"
                  />
                }
              </div>
            }
            @if (!locked() && draft.options.length < maxItems) {
              <p-button
                class="tb-question-add"
                [label]="t.addItem"
                icon="tb-i tb-i-add"
                [text]="true"
                (onClick)="addOption(draft.id)"
              />
            }
          }
          @case ('SHORT_TEXT') {
            @for (answer of draft.accepted; track $index; let n = $index) {
              <div class="tb-question-row">
                <input
                  pInputText
                  class="tb-question-row__field"
                  maxlength="200"
                  autocomplete="off"
                  [disabled]="locked()"
                  [attr.aria-label]="t.answer(n + 1)"
                  [ngModel]="answer"
                  (ngModelChange)="changeAnswer(draft.id, n, $event)"
                />
                @if (!locked()) {
                  <p-button
                    icon="tb-i tb-i-close"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="draft.accepted.length <= 1"
                    [ariaLabel]="t.removeAnswer(n + 1)"
                    (onClick)="removeAnswer(draft.id, n)"
                  />
                }
              </div>
            }
            @if (!locked() && draft.accepted.length < maxAccepted) {
              <p-button
                class="tb-question-add"
                [label]="t.addAnswer"
                icon="tb-i tb-i-add"
                [text]="true"
                (onClick)="addAnswer(draft.id)"
              />
            }
          }
          @case ('NUMBER') {
            <div class="tb-question-pair">
              <div class="tb-field">
                <label [for]="'question-value-' + draft.id">{{ t.value }}</label>
                <p-inputnumber
                  [inputId]="'question-value-' + draft.id"
                  [useGrouping]="false"
                  [maxFractionDigits]="6"
                  [fluid]="true"
                  [disabled]="locked()"
                  [ngModel]="draft.value"
                  (ngModelChange)="change(draft.id, { value: $event })"
                />
              </div>
              <div class="tb-field">
                <label [for]="'question-tolerance-' + draft.id">{{ t.tolerance }}</label>
                <p-inputnumber
                  [inputId]="'question-tolerance-' + draft.id"
                  [useGrouping]="false"
                  [maxFractionDigits]="6"
                  [min]="0"
                  [fluid]="true"
                  [disabled]="locked()"
                  [ngModel]="draft.tolerance"
                  (ngModelChange)="change(draft.id, { tolerance: $event })"
                />
              </div>
            </div>
          }
          @case ('MATCHING') {
            @for (item of draft.pairs; track item.id; let n = $index) {
              <div class="tb-question-row">
                <div class="tb-question-pair tb-question-row__field">
                  <input
                    pInputText
                    maxlength="2000"
                    autocomplete="off"
                    [disabled]="locked()"
                    [attr.aria-label]="t.left(n + 1)"
                    [ngModel]="item.left"
                    (ngModelChange)="changePair(draft.id, item.id, { left: $event })"
                  />
                  <input
                    pInputText
                    maxlength="2000"
                    autocomplete="off"
                    [disabled]="locked()"
                    [attr.aria-label]="t.right(n + 1)"
                    [ngModel]="item.right"
                    (ngModelChange)="changePair(draft.id, item.id, { right: $event })"
                  />
                </div>
                @if (!locked()) {
                  <p-button
                    icon="tb-i tb-i-close"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="draft.pairs.length <= minItems"
                    [ariaLabel]="t.removePair(n + 1)"
                    (onClick)="removePair(draft.id, item.id)"
                  />
                }
              </div>
            }
            @if (!locked() && draft.pairs.length < maxItems) {
              <p-button
                class="tb-question-add"
                [label]="t.addPair"
                icon="tb-i tb-i-add"
                [text]="true"
                (onClick)="addPair(draft.id)"
              />
            }
          }
        }

        <div class="tb-question-pair tb-question-pair--points">
          <div class="tb-field">
            <label [for]="'question-points-' + draft.id">{{ t.points }}</label>
            <p-inputnumber
              [inputId]="'question-points-' + draft.id"
              [min]="1"
              [max]="100"
              [useGrouping]="false"
              [fluid]="true"
              [disabled]="locked()"
              [ngModel]="draft.points"
              (ngModelChange)="change(draft.id, { points: $event ?? 1 })"
            />
          </div>
        </div>

        <div class="tb-field">
          <label [for]="'question-explanation-' + draft.id">{{ t.explanation }}</label>
          <textarea
            pTextarea
            [id]="'question-explanation-' + draft.id"
            rows="2"
            maxlength="2000"
            [disabled]="locked()"
            [ngModel]="draft.explanation"
            (ngModelChange)="change(draft.id, { explanation: $event })"
          ></textarea>
          <small class="tb-hint">{{ t.explanationHint }}</small>
        </div>

        @if (showProblems() && problem(draft); as message) {
          <p class="tb-field__error" role="alert">{{ message }}</p>
        }
      </section>
    }

    @if (!locked() && questions().length < maxQuestions) {
      <div class="tb-question-types" role="group" [attr.aria-label]="t.addQuestion">
        @for (type of types; track type) {
          <p-button
            [label]="t.types[type]"
            icon="tb-i tb-i-add"
            severity="secondary"
            (onClick)="add(type)"
          />
        }
      </div>
    }

    @if (questions().length > 0) {
      <p class="tb-question-total" role="status">{{ total() }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-4);
      justify-items: start;
    }

    :host > * {
      max-width: 100%;
    }

    .tb-question-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-4);
      width: 100%;
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-xs);
      background: var(--tb-list-item);
    }

    .tb-question-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--tb-space-2);
    }

    .tb-question-card__title {
      margin: 0;
      min-width: 0;
      font: var(--p-md-title-medium, inherit);
    }

    .tb-question-card__actions {
      display: flex;
      flex-shrink: 0;
    }

    .tb-question-row {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-question-row__field {
      flex: 1;
      min-width: 0;
    }

    .tb-question-row__number {
      flex-shrink: 0;
      min-width: 1.5rem;
      text-align: center;
      color: var(--p-md-on-surface-variant);
    }

    .tb-question-pair {
      display: grid;
      gap: var(--tb-space-2);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
      align-items: start;
      width: 100%;
    }

    .tb-question-pair--points {
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr));
    }

    .tb-question-add {
      justify-self: start;
    }

    .tb-question-types {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-question-note {
      margin: 0;
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-xs);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-question-total {
      margin: 0;
      color: var(--p-md-on-surface-variant);
    }
  `,
})
export class QuestionSection {
  protected readonly t = T.quiz;
  protected readonly types = QUESTION_TYPES;
  protected readonly minItems = MIN_ITEMS;
  protected readonly maxItems = MAX_ITEMS;
  protected readonly maxAccepted = MAX_ACCEPTED;
  protected readonly maxQuestions = MAX_QUESTIONS;
  readonly questions = model<readonly QuestionDraft[]>([]);
  /** A student started the quiz: the questions are read-only. */
  readonly locked = input(false);
  /** The server refused the questions. */
  readonly error = input<string | null>(null);
  /** The teacher tried to save: show what is wrong in each question. */
  readonly showProblems = input(false);

  protected readonly total = computed(() =>
    T.quiz.total(
      this.questions().length,
      this.questions().reduce((sum, draft) => sum + draft.points, 0),
    ),
  );

  protected problem(draft: QuestionDraft): string | null {
    return questionProblem(draft);
  }

  add(type: QuestionType): void {
    this.questions.update((list) => [...list, questionDraft(type)]);
  }

  remove(id: string): void {
    this.questions.update((list) => list.filter((draft) => draft.id !== id));
  }

  move(id: string, step: -1 | 1): void {
    this.questions.update((list) => moved(list, (draft) => draft.id === id, step));
  }

  change(id: string, patch: Partial<Omit<QuestionDraft, 'id' | 'type'>>): void {
    this.update(id, (draft) => ({ ...draft, ...patch }));
  }

  /** The id of the right option of a single choice. */
  protected correctId(draft: QuestionDraft): string | null {
    return draft.options.find((item) => item.correct)?.id ?? null;
  }

  pick(id: string, optionId: string): void {
    this.update(id, (draft) => ({
      ...draft,
      options: draft.options.map((item) => ({ ...item, correct: item.id === optionId })),
    }));
  }

  addOption(id: string): void {
    this.update(id, (draft) => ({ ...draft, options: [...draft.options, option()] }));
  }

  removeOption(id: string, optionId: string): void {
    this.update(id, (draft) => ({
      ...draft,
      options: draft.options.filter((item) => item.id !== optionId),
    }));
  }

  changeOption(id: string, optionId: string, patch: Partial<Omit<OptionDraft, 'id'>>): void {
    this.update(id, (draft) => ({
      ...draft,
      options: draft.options.map((item) => (item.id === optionId ? { ...item, ...patch } : item)),
    }));
  }

  moveOption(id: string, optionId: string, step: -1 | 1): void {
    this.update(id, (draft) => ({
      ...draft,
      options: moved(draft.options, (item) => item.id === optionId, step),
    }));
  }

  addAnswer(id: string): void {
    this.update(id, (draft) => ({ ...draft, accepted: [...draft.accepted, ''] }));
  }

  removeAnswer(id: string, index: number): void {
    this.update(id, (draft) => ({
      ...draft,
      accepted: draft.accepted.filter((_, position) => position !== index),
    }));
  }

  changeAnswer(id: string, index: number, text: string): void {
    this.update(id, (draft) => ({
      ...draft,
      accepted: draft.accepted.map((answer, position) => (position === index ? text : answer)),
    }));
  }

  addPair(id: string): void {
    this.update(id, (draft) => ({ ...draft, pairs: [...draft.pairs, pair()] }));
  }

  removePair(id: string, pairId: string): void {
    this.update(id, (draft) => ({
      ...draft,
      pairs: draft.pairs.filter((item) => item.id !== pairId),
    }));
  }

  changePair(id: string, pairId: string, patch: Partial<Omit<PairDraft, 'id'>>): void {
    this.update(id, (draft) => ({
      ...draft,
      pairs: draft.pairs.map((item) => (item.id === pairId ? { ...item, ...patch } : item)),
    }));
  }

  private update(id: string, change: (draft: QuestionDraft) => QuestionDraft): void {
    this.questions.update((list) => list.map((draft) => (draft.id === id ? change(draft) : draft)));
  }
}

function sortAttempts(a: number, b: number): number {
  return (a === 0 ? Infinity : a) - (b === 0 ? Infinity : b);
}

/** The list with the matching item one place earlier or later; at the edge — unchanged. */
function moved<A>(list: readonly A[], match: (item: A) => boolean, step: -1 | 1): readonly A[] {
  const from = list.findIndex(match);
  const to = from + step;
  const item = list[from];
  const other = list[to];
  if (item === undefined || other === undefined) {
    return list;
  }
  return list.map((entry, position) => {
    if (position === from) {
      return other;
    }
    return position === to ? item : entry;
  });
}

/** «Как проходит тест»: when the right answers show and how many attempts a student has. */
@Component({
  selector: 'tb-quiz-settings',
  imports: [FormsModule, Select],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-field">
      <label for="quiz-reveal">{{ t.reveal }}</label>
      <p-select
        inputId="quiz-reveal"
        [options]="revealOptions"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [fluid]="true"
        [ngModel]="reveal()"
        (ngModelChange)="reveal.set($event)"
      />
    </div>
    <div class="tb-field">
      <label for="quiz-attempts">{{ t.attempts }}</label>
      <p-select
        inputId="quiz-attempts"
        [options]="attemptOptions()"
        optionLabel="label"
        optionValue="value"
        appendTo="body"
        [fluid]="true"
        [ngModel]="attempts()"
        (ngModelChange)="attempts.set($event)"
      />
      <small class="tb-hint">{{ t.attemptsHint }}</small>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--tb-space-4);
    }
  `,
})
export class QuizSettings {
  protected readonly t = T.quiz;
  protected readonly revealOptions = REVEALS.map((value) => ({
    value,
    label: T.quiz.reveals[value],
  }));

  readonly reveal = model<QuizReveal>('AFTER_SUBMIT');
  /** 0 — unlimited. */
  readonly attempts = model(1);

  protected readonly attemptOptions = computed(() =>
    (ATTEMPTS.includes(this.attempts())
      ? ATTEMPTS
      : [...ATTEMPTS, this.attempts()].sort(sortAttempts)
    ).map((value) => ({ value, label: T.quiz.attemptCount(value) })),
  );
}
