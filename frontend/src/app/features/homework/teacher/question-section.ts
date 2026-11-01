import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Menu } from 'primeng/menu';
import { RowType } from '@shared/ui/row-type.directive';
import { QuestionType, QuizReveal } from '../data-access/homework.models';
import { T } from '../i18n/texts';
import {
  MAX_QUESTIONS,
  QUESTION_ICONS,
  QUESTION_TYPES,
  QuestionDraft,
  copyOf,
  moved,
  problemsOf,
  questionDraft,
  quizMinutes,
} from './question-drafts';
import { QuestionEditor, arrowStep, reordered } from './question-editor';
import { QuizSettings } from './quiz-settings';

/**
 * The «Тест» tab of the assignment editor (ADR-0052, sketches 28–30): the outline of the questions (drag or the
 * arrow keys on a handle reorder them; «Вопрос» adds one of the six types, «С ИИ» opens the assistant), the open
 * question with copy / up / down / remove and «‹ Вопрос 2 · Вопрос 4 ›», and the side column «Как проходит тест»
 * and «Итого». Once a student started the quiz the questions are read-only.
 */
@Component({
  selector: 'tb-question-section',
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    Button,
    Card,
    Menu,
    RowType,
    QuestionEditor,
    QuizSettings,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as message) {
      <p class="tb-field__error tb-qb__wide" role="alert">{{ message }}</p>
    }
    <section class="tb-qb__outline" [attr.aria-label]="t.outline">
      <h2 class="tb-qb__total">{{ t.outlineTotal(questions().length, points()) }}</h2>
      <ol
        class="tb-qb__rows"
        cdkDropList
        [cdkDropListDisabled]="locked()"
        (cdkDropListDropped)="drop($event)"
      >
        @for (draft of questions(); track draft.id; let n = $index) {
          <li
            class="tb-qb__row"
            cdkDrag
            [class.tb-qb__row--open]="draft.id === openId()"
            [class.tb-qb__row--broken]="brokenIds().has(draft.id)"
          >
            @if (!locked()) {
              <button
                type="button"
                class="tb-drag-handle"
                cdkDragHandle
                [attr.data-handle]="draft.id"
                [attr.aria-label]="t.dragQuestion(n + 1)"
                (keydown)="keyMove($event, draft.id)"
              >
                <i class="tb-i tb-i-drag_indicator" aria-hidden="true"></i>
              </button>
            }
            <button
              type="button"
              class="tb-qb__open"
              [attr.data-row]="draft.id"
              [attr.aria-current]="draft.id === openId() ? 'true' : null"
              (click)="open(draft.id)"
            >
              <b class="tb-qb__number">{{ n + 1 }}</b>
              <i
                class="tb-i {{ icons[draft.type] }} tb-qb__icon"
                [title]="t.types[draft.type]"
                aria-hidden="true"
              ></i>
              <span class="tb-qb__text">{{ draft.text.trim() || untitled }}</span>
              @if (brokenIds().has(draft.id)) {
                <i
                  class="tb-i tb-i-error tb-qb__error"
                  role="img"
                  [attr.aria-label]="t.hasProblem"
                ></i>
              }
              <span class="tb-qb__points">{{ draft.points }}</span>
            </button>
          </li>
        }
      </ol>
      @if (!locked() && questions().length < maxQuestions) {
        <div class="tb-qb__add">
          <p-button
            [label]="t.newQuestion"
            icon="tb-i tb-i-add"
            severity="secondary"
            aria-haspopup="menu"
            (onClick)="typeMenu.toggle($event)"
          />
          <p-button
            [label]="t.withAi"
            icon="tb-i tb-i-auto_awesome"
            styleClass="tb-button-ai"
            (onClick)="ai.emit()"
          />
        </div>
        <p-menu
          #typeMenu
          [model]="newItems"
          [popup]="true"
          appendTo="body"
          [ariaLabel]="t.type"
          (onHide)="focusAdded()"
        >
          <ng-template #item let-item [tbRowType]="newItems">
            <a class="p-menu-item-link tb-type-item" data-pc-section="itemlink" tabindex="-1">
              <i class="{{ item.icon }}" aria-hidden="true"></i>
              <span class="tb-type-item__text">
                <span>{{ item.label }}</span>
                <small>{{ item.title }}</small>
              </span>
            </a>
          </ng-template>
        </p-menu>
      }
    </section>

    @if (opened(); as current) {
      <p-card styleClass="tb-section-card" class="tb-qb__question">
        @for (draft of [current.draft]; track draft.id) {
          <tb-question-editor
            [attr.aria-label]="t.heading(current.index + 1)"
            role="group"
            [question]="draft"
            (questionChange)="replace($event)"
            [number]="current.index + 1"
            [locked]="locked()"
            [showProblems]="showProblems()"
          >
            @if (!locked()) {
              <span actions class="tb-qb__actions">
                <p-button
                  icon="tb-i tb-i-content_copy"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [disabled]="questions().length >= maxQuestions"
                  [ariaLabel]="t.copy(current.index + 1)"
                  (onClick)="copy(draft.id)"
                />
                <p-button
                  icon="tb-i tb-i-arrow_upward"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [disabled]="current.index === 0"
                  [ariaLabel]="t.moveUp(current.index + 1)"
                  (onClick)="move(draft.id, -1)"
                />
                <p-button
                  icon="tb-i tb-i-arrow_downward"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [disabled]="current.index === questions().length - 1"
                  [ariaLabel]="t.moveDown(current.index + 1)"
                  (onClick)="move(draft.id, 1)"
                />
                <p-button
                  icon="tb-i tb-i-delete"
                  [text]="true"
                  [rounded]="true"
                  severity="danger"
                  [ariaLabel]="t.remove(current.index + 1)"
                  (onClick)="remove(draft.id)"
                />
              </span>
            }
          </tb-question-editor>
        }
        <nav class="tb-qb__steps" [attr.aria-label]="t.outline">
          @if (questions()[current.index - 1]; as previous) {
            <p-button
              [label]="t.heading(current.index)"
              icon="tb-i tb-i-arrow_back"
              [text]="true"
              (onClick)="open(previous.id)"
            />
          }
          <span class="tb-qb__grow"></span>
          @if (questions()[current.index + 1]; as next) {
            <p-button
              [label]="t.heading(current.index + 2)"
              icon="tb-i tb-i-arrow_forward"
              iconPos="right"
              [text]="true"
              (onClick)="open(next.id)"
            />
          }
        </nav>
      </p-card>
    }

    @if (!compact()) {
      <aside class="tb-qb__side" [attr.aria-label]="t.settings">
        <p-card styleClass="tb-section-card" [header]="t.settings">
          <tb-quiz-settings
            [reveal]="reveal()"
            (revealChange)="reveal.set($event)"
            [attempts]="attempts()"
            (attemptsChange)="attempts.set($event)"
          />
        </p-card>
        <p-card styleClass="tb-section-card tb-section-card--filled" [header]="s.title">
          <dl class="tb-qb__sums">
            <dt>{{ s.questions }}</dt>
            <dd>{{ questions().length }}</dd>
            <dt>{{ s.points }}</dt>
            <dd>{{ points() }}</dd>
            @if (questions().length > 0) {
              <dt>{{ s.time }}</dt>
              <dd>{{ s.minutes(minutes()[0], minutes()[1]) }}</dd>
            }
          </dl>
          @if (showProblems()) {
            @for (item of problems(); track item.id) {
              <p class="tb-qb__problem">
                <i class="tb-i tb-i-error" aria-hidden="true"></i>
                <span class="tb-qb__grow">{{ s.problem(item.number, item.problem) }}</span>
                <a
                  href=""
                  [attr.aria-label]="s.openProblem(item.number)"
                  (click)="$event.preventDefault(); open(item.id)"
                  >{{ s.open }}</a
                >
              </p>
            }
          }
        </p-card>
      </aside>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-6);
      align-items: flex-start;
    }

    .tb-qb__wide {
      flex: 1 0 100%;
      margin: 0;
    }

    .tb-qb__outline {
      display: grid;
      gap: var(--tb-space-2);
      flex: 0 0 18.75rem;
      min-width: 0;
      max-width: 100%;
    }

    .tb-qb__total {
      margin: 0;
      padding-inline: var(--tb-space-1);
      font: var(--tb-type-label-m);
      text-transform: uppercase;
      letter-spacing: 0.03rem;
      color: var(--p-md-on-surface-variant);
    }

    /* the outline is a segmented list (design-system §10): 2 px gaps, 16 px outer and 4 px inner corners */
    .tb-qb__rows {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
      border-radius: var(--tb-shape-lg);
      overflow: hidden;
    }

    .tb-qb__row {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      min-height: 3.5rem;
      padding-inline-start: var(--tb-space-2);
      border-radius: var(--tb-shape-xs);
      background: var(--p-md-surface-container);
    }

    .tb-qb__row--open {
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
    }

    .tb-qb__row--broken {
      background: var(--p-md-error-container);
      color: var(--p-md-on-error-container);
    }

    .tb-qb__row.cdk-drag-preview {
      box-shadow: var(--tb-elevation-2);
    }

    .tb-qb__row.cdk-drag-placeholder {
      opacity: 0.4;
    }

    .tb-qb__open {
      display: flex;
      flex: 1;
      align-items: center;
      gap: var(--tb-space-3);
      min-width: 0;
      align-self: stretch;
      padding: var(--tb-space-3) var(--tb-space-4) var(--tb-space-3) var(--tb-space-1);
      border: 0;
      background: transparent;
      color: inherit;
      font: var(--tb-type-body-m);
      text-align: start;
      cursor: pointer;
    }

    .tb-qb__number {
      min-width: 1.125rem;
    }

    .tb-qb__icon {
      font-size: 1.25rem;
      color: var(--p-md-primary);
    }

    .tb-qb__row--broken .tb-qb__icon {
      color: inherit;
    }

    .tb-qb__text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tb-qb__error {
      font-size: 1.25rem;
      color: var(--p-md-error);
    }

    .tb-qb__points {
      min-width: 1.25rem;
      text-align: end;
      font: var(--tb-type-body-s);
    }

    .tb-qb__add {
      display: flex;
      gap: var(--tb-space-2);
      margin-top: var(--tb-space-2);
    }

    .tb-qb__add > * {
      flex: 1;
    }

    .tb-qb__question {
      flex: 999 1 30rem;
      min-width: 0;
    }

    .tb-qb__actions {
      display: flex;
    }

    .tb-qb__steps {
      display: flex;
      align-items: center;
      margin-top: var(--tb-space-4);
      padding-top: var(--tb-space-3);
      border-top: 1px solid var(--p-md-outline-variant);
    }

    .tb-qb__grow {
      flex: 1;
    }

    .tb-qb__side {
      display: grid;
      gap: var(--tb-space-4);
      flex: 1 1 17.5rem;
      max-width: 21.25rem;
      min-width: 0;
    }

    .tb-qb__sums {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--tb-space-2);
      margin: 0;
    }

    .tb-qb__sums dd {
      margin: 0;
      font-weight: 600;
    }

    .tb-qb__problem {
      display: flex;
      gap: var(--tb-space-2);
      align-items: center;
      margin: 0;
      padding: var(--tb-space-2) var(--tb-space-3);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-error-container);
      color: var(--p-md-on-error-container);
    }

    .tb-qb__problem a {
      color: inherit;
      font-weight: 600;
    }
  `,
})
export class QuestionSection {
  protected readonly t = T.quiz;
  protected readonly s = T.quiz.summary;
  protected readonly untitled = T.editor.untitledQuestion;
  protected readonly icons = QUESTION_ICONS;
  protected readonly maxQuestions = MAX_QUESTIONS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly questions = model<readonly QuestionDraft[]>([]);
  readonly reveal = model<QuizReveal>('AFTER_SUBMIT');
  /** 0 — unlimited. */
  readonly attempts = model(1);
  /** A student started the quiz: the questions are read-only. */
  readonly locked = input(false);
  /** The server refused the questions. */
  readonly error = input<string | null>(null);
  /** «Выдать» was tried: show what is wrong in each question. */
  readonly showProblems = input(false);
  /** A phone: «Как проходит тест» is a tab of its own. */
  readonly compact = input(false);
  /** «С ИИ»: the assistant drafts questions. */
  readonly ai = output();

  /** A question just added from the menu: its text takes the focus once the menu closes. */
  private added: string | null = null;
  /** The question open beside the outline; the first one until another is chosen. */
  private readonly chosenId = signal<string | null>(null);

  protected readonly newItems: MenuItem[] = QUESTION_TYPES.map((type) => ({
    label: T.quiz.types[type],
    title: T.quiz.typeMenuHints[type],
    icon: `tb-i ${QUESTION_ICONS[type]}`,
    command: () => {
      this.add(type);
    },
  }));

  protected readonly points = computed(() =>
    this.questions().reduce((sum, draft) => sum + draft.points, 0),
  );
  protected readonly minutes = computed(() => quizMinutes(this.questions().length));
  protected readonly problems = computed(() => problemsOf(this.questions()));
  protected readonly brokenIds = computed(
    () => new Set(this.showProblems() ? this.problems().map((item) => item.id) : []),
  );
  protected readonly openId = computed(() => {
    const list = this.questions();
    const chosen = this.chosenId();
    return list.some((draft) => draft.id === chosen) ? chosen : (list[0]?.id ?? null);
  });
  protected readonly opened = computed(() => {
    const index = this.questions().findIndex((draft) => draft.id === this.openId());
    const draft = this.questions()[index];
    return draft === undefined ? null : { draft, index };
  });

  constructor() {
    // «Выдать» found problems: the first broken question opens
    effect(() => {
      if (this.showProblems()) {
        untracked(() => {
          const first = this.problems()[0];
          if (first !== undefined && !this.problems().some((item) => item.id === this.openId())) {
            this.chosenId.set(first.id);
          }
        });
      }
    });
  }

  open(id: string): void {
    this.chosenId.set(id);
  }

  add(type: QuestionType): void {
    const draft = questionDraft(type);
    this.questions.update((list) => [...list, draft]);
    this.chosenId.set(draft.id);
    this.added = draft.id;
  }

  /** The menu gives the focus back to «Вопрос» as it closes: then it goes to the new question. */
  protected focusAdded(): void {
    if (this.added !== null) {
      this.focusLater(`#question-text-${this.added}`);
      this.added = null;
    }
  }

  copy(id: string): void {
    const index = this.questions().findIndex((draft) => draft.id === id);
    const source = this.questions()[index];
    if (source === undefined) {
      return;
    }
    const duplicate = copyOf(source);
    this.questions.update((list) => [
      ...list.slice(0, index + 1),
      duplicate,
      ...list.slice(index + 1),
    ]);
    this.chosenId.set(duplicate.id);
  }

  /** The next question opens in place of the removed one (the previous one at the end). */
  remove(id: string): void {
    const list = this.questions();
    const index = list.findIndex((draft) => draft.id === id);
    const neighbour = list[index + 1] ?? list[index - 1];
    this.questions.set(list.filter((draft) => draft.id !== id));
    this.chosenId.set(neighbour?.id ?? null);
  }

  move(id: string, step: -1 | 1): void {
    this.questions.update((list) => moved(list, (draft) => draft.id === id, step));
  }

  replace(changed: QuestionDraft): void {
    this.questions.update((list) =>
      list.map((draft) => (draft.id === changed.id ? changed : draft)),
    );
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.questions.update((list) => reordered(list, event.previousIndex, event.currentIndex));
  }

  /** The arrow keys on a handle move the question; the focus stays on its handle. */
  protected keyMove(event: KeyboardEvent, id: string): void {
    const step = arrowStep(event);
    if (step === null) {
      return;
    }
    event.preventDefault();
    this.move(id, step);
    this.focusLater(`[data-handle="${id}"]`);
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
