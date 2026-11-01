import { NgTemplateOutlet } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Menu } from 'primeng/menu';
import { RadioButton } from 'primeng/radiobutton';
import { Textarea } from 'primeng/textarea';
import { Confirm } from '@shared/ui/confirm';
import { InputChip } from '@shared/ui/input-chip';
import { QuestionType } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import {
  MAX_ACCEPTED,
  MAX_ITEMS,
  MAX_POINTS,
  MIN_ITEMS,
  OptionDraft,
  PairDraft,
  QUESTION_ICONS,
  QUESTION_TYPES,
  QuestionDraft,
  moved,
  option,
  pair,
  questionProblem,
  retyped,
} from './question-drafts';

/**
 * One open question of the quiz builder (sketches 28, 29, 31): its type (a change keeps what fits), the Markdown
 * text, the answer fields of the type — options and items reorder by drag or by the arrow keys on their handle,
 * Enter in the last one adds the next —, the points stepper and the explanation, folded while empty. Projected
 * `[actions]` sit in the first row after the type.
 */
@Component({
  selector: 'tb-question-editor',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    Button,
    Checkbox,
    InputChip,
    InputNumber,
    InputText,
    Menu,
    RadioButton,
    Textarea,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let q = question();
    <div class="tb-qe__head">
      @if (heading()) {
        <h3 class="tb-qe__title">{{ t.heading(number()) }}</h3>
      }
      <p-button
        styleClass="tb-qe__type"
        [label]="t.types[q.type]"
        icon="tb-i {{ icons[q.type] }}"
        severity="secondary"
        [disabled]="locked()"
        [ariaLabel]="t.type + ': ' + t.types[q.type]"
        aria-haspopup="menu"
        (onClick)="typeMenu.toggle($event)"
      />
      <p-menu #typeMenu [model]="typeItems()" [popup]="true" appendTo="body" />
      <span class="tb-qe__spacer"></span>
      <ng-content select="[actions]" />
      @if (compact()) {
        <ng-container [ngTemplateOutlet]="stepper" />
      }
    </div>

    <div class="tb-field">
      <label [for]="'question-text-' + q.id">{{ t.text }}</label>
      <textarea
        pTextarea
        [id]="'question-text-' + q.id"
        rows="3"
        maxlength="2000"
        [autoResize]="true"
        [disabled]="locked()"
        [ngModel]="q.text"
        (ngModelChange)="patch({ text: $event })"
      ></textarea>
      <small class="tb-hint">{{ t.textHint }}</small>
    </div>

    @switch (q.type) {
      @case ('SHORT_TEXT') {
        <div class="tb-qe__group" role="group" [attr.aria-labelledby]="'accepted-' + q.id">
          <span class="tb-qe__label" [id]="'accepted-' + q.id">{{ t.acceptedLabel }}</span>
          @if (q.accepted.length > 0) {
            <div class="tb-qe__chips">
              @for (answer of q.accepted; track $index) {
                <tb-input-chip
                  class="tb-qe__answer"
                  [label]="answer"
                  [readonly]="locked()"
                  [removeLabel]="t.removeAnswer(answer)"
                  (removed)="removeAnswer($index)"
                />
              }
            </div>
          }
          @if (!locked() && q.accepted.length < maxAccepted) {
            <input
              pInputText
              class="tb-qe__new-answer"
              maxlength="200"
              autocomplete="off"
              [placeholder]="t.acceptedPlaceholder"
              [attr.aria-label]="t.newAnswer"
              [ngModel]="answer()"
              (ngModelChange)="answer.set($event)"
              (keydown.enter)="addAnswer($event)"
              (blur)="addAnswer()"
            />
          }
        </div>
      }
      @case ('NUMBER') {
        <div class="tb-qe__pair">
          <div class="tb-field">
            <label [for]="'question-value-' + q.id">{{ t.value }}</label>
            <p-inputnumber
              [inputId]="'question-value-' + q.id"
              [useGrouping]="false"
              [maxFractionDigits]="6"
              [fluid]="true"
              [disabled]="locked()"
              [ngModel]="q.value"
              (ngModelChange)="patch({ value: $event })"
            />
          </div>
          <div class="tb-field">
            <label [for]="'question-tolerance-' + q.id">{{ t.tolerance }}</label>
            <p-inputnumber
              [inputId]="'question-tolerance-' + q.id"
              [useGrouping]="false"
              [maxFractionDigits]="6"
              [min]="0"
              [fluid]="true"
              [disabled]="locked()"
              [ngModel]="q.tolerance"
              (ngModelChange)="patch({ tolerance: $event })"
            />
          </div>
        </div>
      }
      @case ('MATCHING') {
        <div class="tb-qe__group" role="group" [attr.aria-label]="t.types.MATCHING">
          <div class="tb-qe__match tb-qe__match--head" aria-hidden="true">
            <span class="tb-qe__label">{{ t.leftColumn }}</span>
            <span></span>
            <span class="tb-qe__label">{{ t.rightColumn }}</span>
          </div>
          @for (item of q.pairs; track item.id; let n = $index) {
            <div class="tb-qe__match">
              <input
                pInputText
                maxlength="2000"
                autocomplete="off"
                [attr.data-pair]="item.id"
                [disabled]="locked()"
                [attr.aria-label]="t.left(n + 1)"
                [ngModel]="item.left"
                (ngModelChange)="changePair(item.id, { left: $event })"
              />
              <i class="tb-i tb-i-arrow_forward tb-qe__arrow" aria-hidden="true"></i>
              <input
                pInputText
                maxlength="2000"
                autocomplete="off"
                [disabled]="locked()"
                [attr.aria-label]="t.right(n + 1)"
                [ngModel]="item.right"
                (ngModelChange)="changePair(item.id, { right: $event })"
                (keydown.enter)="enterPair($event, n)"
              />
              @if (!locked()) {
                <p-button
                  icon="tb-i tb-i-close"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [disabled]="q.pairs.length <= minItems"
                  [ariaLabel]="t.removePair(n + 1)"
                  (onClick)="removePair(item.id)"
                />
              }
            </div>
          }
          @if (!locked() && q.pairs.length < maxItems) {
            <p-button
              class="tb-qe__add"
              [label]="t.addPair"
              icon="tb-i tb-i-add"
              [text]="true"
              (onClick)="addPair()"
            />
          }
        </div>
      }
      @default {
        <div class="tb-qe__group">
          <span class="tb-qe__label" [id]="'options-' + q.id">{{ optionsLabel() }}</span>
          <div
            class="tb-qe__options"
            role="list"
            [attr.aria-labelledby]="'options-' + q.id"
            cdkDropList
            [cdkDropListDisabled]="locked()"
            (cdkDropListDropped)="dropOption($event)"
          >
            @for (item of q.options; track item.id; let n = $index) {
              <div
                class="tb-qe__option"
                role="listitem"
                cdkDrag
                [class.tb-qe__option--correct]="item.correct"
              >
                @if (!locked()) {
                  <button
                    type="button"
                    class="tb-drag-handle"
                    cdkDragHandle
                    [attr.data-handle]="item.id"
                    [attr.aria-label]="t.dragOption(n + 1)"
                    (keydown)="keyMoveOption($event, item.id)"
                  >
                    <i class="tb-i tb-i-drag_indicator" aria-hidden="true"></i>
                  </button>
                }
                @switch (q.type) {
                  @case ('SINGLE_CHOICE') {
                    <p-radiobutton
                      [name]="'correct-' + q.id"
                      [value]="item.id"
                      [ngModel]="correctId()"
                      (ngModelChange)="pick($event)"
                      [disabled]="locked()"
                      [inputId]="'correct-' + item.id"
                      [ariaLabel]="t.correct(item.text || t.option(n + 1))"
                    />
                  }
                  @case ('MULTIPLE_CHOICE') {
                    <p-checkbox
                      [binary]="true"
                      [ngModel]="item.correct"
                      (ngModelChange)="changeOption(item.id, { correct: $event })"
                      [disabled]="locked()"
                      [inputId]="'correct-' + item.id"
                      [ariaLabel]="t.correct(item.text || t.option(n + 1))"
                    />
                  }
                  @default {
                    <b class="tb-qe__number" aria-hidden="true">{{ n + 1 }}</b>
                  }
                }
                <input
                  pInputText
                  class="tb-qe__field"
                  maxlength="2000"
                  autocomplete="off"
                  [attr.data-option]="item.id"
                  [disabled]="locked()"
                  [placeholder]="ordering() ? t.item(n + 1) : t.option(n + 1)"
                  [attr.aria-label]="ordering() ? t.item(n + 1) : t.option(n + 1)"
                  [ngModel]="item.text"
                  (ngModelChange)="changeOption(item.id, { text: $event })"
                  (keydown.enter)="enterOption($event, n)"
                />
                @if (item.correct) {
                  <span class="tb-qe__correct" aria-hidden="true">{{ t.correctTag }}</span>
                }
                @if (!locked()) {
                  <p-button
                    icon="tb-i tb-i-close"
                    [text]="true"
                    [rounded]="true"
                    severity="secondary"
                    [disabled]="q.options.length <= minItems"
                    [ariaLabel]="ordering() ? t.removeItem(n + 1) : t.removeOption(n + 1)"
                    (onClick)="removeOption(item.id)"
                  />
                }
              </div>
            }
          </div>
          @if (!locked() && q.options.length < maxItems) {
            <p-button
              class="tb-qe__add"
              [label]="ordering() ? t.addItem : t.addOption"
              icon="tb-i tb-i-add"
              [text]="true"
              (onClick)="addOption()"
            />
            @if (!ordering()) {
              <small class="tb-hint">{{ t.enterHint }}</small>
            }
          }
        </div>
      }
    }

    <p class="tb-qe__rule">
      @if (q.type === 'MATCHING' || q.type === 'ORDERING') {
        <i class="tb-i tb-i-shuffle" aria-hidden="true"></i>
      } @else {
        <i class="tb-i tb-i-info" aria-hidden="true"></i>
      }
      <span>{{ t.typeHints[q.type] }}</span>
    </p>

    @if (showProblems() && problem(); as message) {
      <p class="tb-qe__error" role="alert">
        <i class="tb-i tb-i-error" aria-hidden="true"></i>{{ message }}
      </p>
    }

    <div class="tb-qe__bottom">
      @if (!compact()) {
        <div class="tb-qe__points">
          <label class="tb-qe__label" [for]="'question-points-' + q.id">{{ t.points }}</label>
          <ng-container [ngTemplateOutlet]="stepper" />
        </div>
      }
      @if (explaining() || q.explanation !== '') {
        <div class="tb-field tb-qe__explanation">
          <label [for]="'question-explanation-' + q.id">{{ t.explanation }}</label>
          <textarea
            pTextarea
            [id]="'question-explanation-' + q.id"
            rows="2"
            maxlength="2000"
            [autoResize]="true"
            [disabled]="locked()"
            [ngModel]="q.explanation"
            (ngModelChange)="patch({ explanation: $event })"
          ></textarea>
          <small class="tb-hint">{{ t.explanationHint }}</small>
        </div>
      } @else if (!locked()) {
        <p-button
          class="tb-qe__unfold"
          [label]="t.explanation"
          icon="tb-i tb-i-lightbulb"
          severity="secondary"
          (onClick)="unfold()"
        />
      }
    </div>

    <ng-template #stepper>
      <p-inputnumber
        styleClass="tb-stepper"
        [inputId]="'question-points-' + q.id"
        [showButtons]="true"
        buttonLayout="horizontal"
        incrementButtonIcon="tb-i tb-i-add"
        decrementButtonIcon="tb-i tb-i-remove"
        [min]="1"
        [max]="maxPoints"
        [useGrouping]="false"
        [disabled]="locked()"
        [ariaLabel]="t.points"
        [ngModel]="q.points"
        (ngModelChange)="patch({ points: $event ?? 1 })"
      />
    </ng-template>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-4);
    }

    .tb-qe__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-qe__title {
      margin: 0;
      font: var(--tb-type-title-m-emphasized);
    }

    .tb-qe__spacer {
      flex: 1;
    }

    .tb-qe__group {
      display: grid;
      gap: var(--tb-space-2);
      justify-items: start;
    }

    .tb-qe__group > * {
      max-width: 100%;
    }

    .tb-qe__label {
      font: var(--tb-type-label-m);
      color: var(--p-md-on-surface-variant);
    }

    .tb-qe__options {
      display: grid;
      gap: var(--tb-space-2);
      width: 100%;
    }

    /* an option row (sketch 28): a 48 dp tonal row, the right one in the success container (ours) */
    .tb-qe__option {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      min-height: 3rem;
      box-sizing: border-box;
      padding: var(--tb-space-1) var(--tb-space-1) var(--tb-space-1) var(--tb-space-2);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-surface-container-low);
    }

    .tb-qe__option--correct {
      background: var(--p-md-success-container);
      color: var(--p-md-on-success-container);
    }

    .tb-qe__option.cdk-drag-preview {
      box-shadow: var(--tb-elevation-2);
      background: var(--p-md-secondary-container);
    }

    .tb-qe__option.cdk-drag-placeholder {
      opacity: 0.4;
    }

    .tb-qe__field {
      flex: 1;
      min-width: 0;
    }

    .tb-qe__number {
      min-width: 1rem;
      text-align: center;
    }

    .tb-qe__correct {
      font: var(--tb-type-label-m);
    }

    .tb-qe__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-qe__new-answer,
    .tb-qe__pair {
      width: 100%;
    }

    .tb-qe__pair {
      display: grid;
      gap: var(--tb-space-3);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr));
    }

    .tb-qe__match {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 1.5rem minmax(0, 1fr) 2.5rem;
      gap: var(--tb-space-2);
      align-items: center;
      width: 100%;
    }

    .tb-qe__arrow {
      color: var(--p-md-on-surface-variant);
    }

    .tb-qe__rule,
    .tb-qe__error {
      display: flex;
      gap: var(--tb-space-2);
      align-items: flex-start;
      margin: 0;
      padding: var(--tb-space-2) var(--tb-space-3);
      border-radius: var(--tb-shape-md);
      font: var(--tb-type-body-s);
    }

    .tb-qe__rule {
      background: var(--p-md-surface-container-low);
      color: var(--p-md-on-surface-variant);
    }

    .tb-qe__error {
      background: var(--p-md-error-container);
      color: var(--p-md-on-error-container);
    }

    .tb-qe__rule .tb-i,
    .tb-qe__error .tb-i {
      font-size: 1.125rem;
    }

    .tb-qe__bottom {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-6);
      align-items: flex-start;
    }

    .tb-qe__points {
      display: grid;
      gap: var(--tb-space-2);
      justify-items: start;
    }

    .tb-qe__explanation {
      flex: 1 1 18rem;
    }

    .tb-qe__unfold {
      align-self: flex-end;
    }
  `,
})
export class QuestionEditor {
  protected readonly t = T.quiz;
  protected readonly icons = QUESTION_ICONS;
  protected readonly minItems = MIN_ITEMS;
  protected readonly maxItems = MAX_ITEMS;
  protected readonly maxAccepted = MAX_ACCEPTED;
  protected readonly maxPoints = MAX_POINTS;
  private readonly confirm = inject(Confirm);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly question = model.required<QuestionDraft>();
  /** Its place in the quiz, from 1. */
  readonly number = input.required<number>();
  /** «Вопрос N» in the first row; the full-screen question has it in its header. */
  readonly heading = input(true);
  /** A student started the quiz: read-only. */
  readonly locked = input(false);
  /** «Выдать» was tried: say what is wrong. */
  readonly showProblems = input(false);
  /** A phone: the points beside the type, nothing below. */
  readonly compact = input(false);

  /** The accepted answer being typed. */
  protected readonly answer = signal('');
  /** The explanation was unfolded while still empty. */
  protected readonly explaining = signal(false);

  protected readonly ordering = computed(() => this.question().type === 'ORDERING');
  protected readonly problem = computed(() => questionProblem(this.question()));
  protected readonly correctId = computed(
    () => this.question().options.find((item) => item.correct)?.id ?? null,
  );
  protected readonly optionsLabel = computed(() => {
    const type = this.question().type;
    return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE' || type === 'ORDERING'
      ? this.t.optionsLabel[type]
      : '';
  });
  protected readonly typeItems = computed<MenuItem[]>(() =>
    QUESTION_TYPES.map((type) => ({
      label: this.t.types[type],
      icon: `tb-i ${QUESTION_ICONS[type]}`,
      command: () => {
        void this.retype(type);
      },
    })),
  );

  patch(change: Partial<Omit<QuestionDraft, 'id' | 'type'>>): void {
    this.question.update((draft) => ({ ...draft, ...change }));
  }

  /** Another type: what fits stays; when answers would be lost the teacher confirms first. */
  async retype(type: QuestionType): Promise<void> {
    const current = this.question();
    if (type === current.type) {
      return;
    }
    const { draft, lossy } = retyped(current, type);
    if (
      lossy &&
      !(await this.confirm.danger({
        header: this.t.retype.header,
        message: this.t.retype.message,
        acceptLabel: this.t.retype.accept,
      }))
    ) {
      return;
    }
    this.question.set(draft);
  }

  pick(optionId: string): void {
    this.question.update((draft) => ({
      ...draft,
      options: draft.options.map((item) => ({ ...item, correct: item.id === optionId })),
    }));
  }

  addOption(): void {
    const added = option();
    this.question.update((draft) => ({ ...draft, options: [...draft.options, added] }));
    this.focusLater(`[data-option="${added.id}"]`);
  }

  /** Enter: to the next option, from the last one — a new option. */
  protected enterOption(event: Event, index: number): void {
    event.preventDefault();
    const next = this.question().options[index + 1];
    if (next !== undefined) {
      this.focusLater(`[data-option="${next.id}"]`);
    } else if (this.question().options.length < MAX_ITEMS) {
      this.addOption();
    }
  }

  removeOption(optionId: string): void {
    this.question.update((draft) => ({
      ...draft,
      options: draft.options.filter((item) => item.id !== optionId),
    }));
  }

  changeOption(optionId: string, change: Partial<Omit<OptionDraft, 'id'>>): void {
    this.question.update((draft) => ({
      ...draft,
      options: draft.options.map((item) => (item.id === optionId ? { ...item, ...change } : item)),
    }));
  }

  protected dropOption(event: CdkDragDrop<unknown>): void {
    this.question.update((draft) => ({
      ...draft,
      options: reordered(draft.options, event.previousIndex, event.currentIndex),
    }));
  }

  /** The arrow keys on a handle move the option; the focus stays on its handle. */
  protected keyMoveOption(event: KeyboardEvent, optionId: string): void {
    const step = arrowStep(event);
    if (step === null) {
      return;
    }
    event.preventDefault();
    this.question.update((draft) => ({
      ...draft,
      options: moved(draft.options, (item) => item.id === optionId, step),
    }));
    this.focusLater(`[data-handle="${optionId}"]`);
  }

  /** Enter or leaving the field keeps the typed answer as a chip. */
  addAnswer(event?: Event): void {
    event?.preventDefault();
    const text = this.answer().trim();
    this.answer.set('');
    if (text === '' || this.question().accepted.includes(text)) {
      return;
    }
    this.question.update((draft) => ({ ...draft, accepted: [...draft.accepted, text] }));
  }

  removeAnswer(index: number): void {
    this.question.update((draft) => ({
      ...draft,
      accepted: draft.accepted.filter((_, position) => position !== index),
    }));
  }

  addPair(): void {
    const added = pair();
    this.question.update((draft) => ({ ...draft, pairs: [...draft.pairs, added] }));
    this.focusLater(`[data-pair="${added.id}"]`);
  }

  /** Enter in the right part of the last pair adds the next pair. */
  protected enterPair(event: Event, index: number): void {
    event.preventDefault();
    const next = this.question().pairs[index + 1];
    if (next !== undefined) {
      this.focusLater(`[data-pair="${next.id}"]`);
    } else if (this.question().pairs.length < MAX_ITEMS) {
      this.addPair();
    }
  }

  removePair(pairId: string): void {
    this.question.update((draft) => ({
      ...draft,
      pairs: draft.pairs.filter((item) => item.id !== pairId),
    }));
  }

  changePair(pairId: string, change: Partial<Omit<PairDraft, 'id'>>): void {
    this.question.update((draft) => ({
      ...draft,
      pairs: draft.pairs.map((item) => (item.id === pairId ? { ...item, ...change } : item)),
    }));
  }

  protected unfold(): void {
    this.explaining.set(true);
    this.focusLater(`#question-explanation-${this.question().id}`);
  }

  private focusLater(selector: string): void {
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
      },
      { injector: this.injector },
    );
  }
}

/** −1 for ↑, 1 for ↓, `null` for any other key. */
export function arrowStep(event: KeyboardEvent): -1 | 1 | null {
  if (event.key === 'ArrowUp') {
    return -1;
  }
  return event.key === 'ArrowDown' ? 1 : null;
}

/** The list with the item moved from one place to another (a drop of CDK drag-drop). */
export function reordered<A>(list: readonly A[], from: number, to: number): readonly A[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  if (item !== undefined) {
    copy.splice(to, 0, item);
  }
  return copy;
}
