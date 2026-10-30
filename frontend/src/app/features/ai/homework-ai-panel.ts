import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Injectable,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Popover } from 'primeng/popover';
import { SelectButton } from 'primeng/selectbutton';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { MarkdownView } from '@shared/ui/markdown-view';
import { AiApi } from './data-access/ai-api';
import {
  DraftSource,
  DraftedQuestion,
  HomeworkDraft,
  SavedPrompt,
  SourceOption,
} from './data-access/ai.models';
import { T } from './i18n/texts';
import { SearchField } from '@shared/ui/search-field';
import { AssistChip } from '@shared/ui/assist-chip';
import { Segment, SegmentGroup } from '@shared/ui/segment-group';

/** A draft the teacher took: it replaces the assignment's content or goes after its text. */
export interface AppliedDraft {
  readonly draft: HomeworkDraft;
  readonly mode: 'replace' | 'insert';
}

/** Drafted questions the teacher took: they go after the questions of the quiz or replace them. */
export interface AppliedQuestions {
  readonly questions: readonly DraftedQuestion[];
  readonly mode: 'replace' | 'append';
}

export type AiMode = 'TASK' | 'QUESTIONS';

/** State belongs to the editor so adapting or closing its supporting pane preserves ongoing work. */
@Injectable()
export class HomeworkAiState {
  readonly prompt = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(4_000)],
  });
  readonly promptTitle = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });
  readonly library = signal<SavedPrompt[]>([]);
  readonly query = signal('');
  readonly mode = signal<AiMode>('TASK');
  readonly draft = signal<HomeworkDraft | null>(null);
  readonly questions = signal<readonly DraftedQuestion[] | null>(null);
  /** The variants of the task draft in the order they came, and the one shown. */
  readonly history = signal<readonly HomeworkDraft[]>([]);
  readonly variant = signal(0);
  /** Keys of the chosen sources. */
  readonly chosen = signal<ReadonlySet<string>>(new Set());
  readonly pending = signal(false);
  readonly naming = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly focused = signal(false);
}

/**
 * The AI assistant over the assignment text: a request in the teacher's words (typed, or taken from the prompt
 * library in the «Промты» menu), the sources it reads, and the draft it brings — between the request and the text.
 * Nothing reaches the assignment until the teacher says so.
 */
@Component({
  selector: 'tb-homework-ai-panel',
  imports: [
    SearchField,
    AssistChip,
    SegmentGroup,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Checkbox,
    InputText,
    Message,
    Popover,
    SelectButton,
    Textarea,
    MarkdownView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-popover #prompts [ariaLabel]="t.prompts" (onHide)="naming.set(false); query.set('')">
      <div class="tb-ai-panel__menu">
        @if (naming()) {
          <div class="tb-field">
            <label for="ai-prompt-title">{{ t.promptTitle }}</label>
            <input
              pInputText
              id="ai-prompt-title"
              [formControl]="promptTitle"
              autocomplete="off"
              (keydown.enter)="savePrompt()"
            />
          </div>
          <div class="tb-actions tb-ai-panel__end">
            <p-button
              [label]="t.cancel"
              severity="secondary"
              [text]="true"
              (onClick)="naming.set(false)"
            />
            <p-button [label]="t.save" [loading]="saving()" (onClick)="savePrompt()" />
          </div>
        } @else {
          @if (library().length > 0) {
            <tb-search-field
              class="tb-ai-panel__search"
              [label]="t.search"
              [ngModel]="query()"
              (ngModelChange)="query.set($event)"
            />
            <div class="tb-ai-panel__library" role="group" [attr.aria-label]="t.prompts">
              @for (prompt of found(); track prompt.id) {
                <button type="button" class="tb-ai-panel__option" (click)="use(prompt)">
                  <span>{{ prompt.title }}</span>
                  <small>{{ prompt.text }}</small>
                </button>
              } @empty {
                <p class="tb-hint">{{ t.notFound }}</p>
              }
            </div>
          } @else {
            <p class="tb-hint">{{ t.noPrompts }}</p>
          }
          <div class="tb-ai-panel__menu-actions">
            <p-button
              [label]="t.savePrompt"
              icon="tb-i tb-i-bookmark"
              severity="secondary"
              [text]="true"
              (onClick)="startNaming()"
            />
            <a
              pButton
              routerLink="/teacher/settings/ai"
              fragment="prompt-library"
              severity="secondary"
              [text]="true"
            >
              <i pButtonIcon aria-hidden="true" class="tb-i tb-i-settings"></i>
              <span pButtonLabel>{{ t.manage }}</span>
            </a>
          </div>
        }
      </div>
    </p-popover>

    @if (pane()) {
      <section class="tb-ai-pane" [attr.aria-label]="t.title">
        <tb-segment-group
          class="tb-ai-pane__mode"
          [label]="t.modeLabel"
          [outlined]="true"
          [segments]="paneModes"
          [(value)]="mode"
        />
        <div class="tb-field">
          <label for="ai-prompt">{{ t.need }}</label>
          <textarea
            pTextarea
            id="ai-prompt"
            class="tb-ai-pane__prompt"
            [formControl]="prompt"
            rows="3"
            [placeholder]="mode() === 'TASK' ? t.placeholder : t.questionsPlaceholder"
          ></textarea>
          <div class="tb-ai-pane__chips">
            @for (hint of suggestions; track hint.label) {
              <tb-assist-chip (click)="prompt.setValue(hint.text)">{{ hint.label }}</tb-assist-chip>
            }
            <tb-assist-chip icon="bookmarks" (click)="prompts.toggle($event)">{{
              t.myPrompts
            }}</tb-assist-chip>
          </div>
        </div>

        <div class="tb-ai-pane__sources">
          <span class="tb-ai-pane__label">{{ t.considers }}</span>
          @for (option of sources(); track option.key) {
            <div class="tb-ai-pane__source">
              <i class="tb-i tb-i-menu_book" aria-hidden="true"></i>
              <label class="tb-ai-pane__source-name" [for]="'ai-source-' + option.key">{{
                option.label
              }}</label>
              <p-checkbox
                [inputId]="'ai-source-' + option.key"
                [binary]="true"
                [ngModel]="chosen().has(option.key)"
                (ngModelChange)="toggle(option.key, $event)"
              />
            </div>
          } @empty {
            <small class="tb-hint">{{ t.noSources }}</small>
          }
          <tb-assist-chip icon="add" [dashed]="true" (click)="sourceAdd.emit()">{{
            t.addSource
          }}</tb-assist-chip>
        </div>

        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
        @if (mode() === 'TASK' && draft(); as current) {
          <section class="tb-ai-pane__draft" [attr.aria-label]="t.draft">
            <header class="tb-ai-pane__draft-header">
              <span class="tb-ai-pane__badge">{{ t.draft }}</span>
              <span class="tb-ai-pane__grow"></span>
              <span class="tb-hint">{{ t.variantOf(variant() + 1, history().length) }}</span>
              <p-button
                icon="tb-i tb-i-chevron_left"
                severity="secondary"
                [text]="true"
                [rounded]="true"
                [ariaLabel]="t.previous"
                [disabled]="variant() === 0"
                (onClick)="show(variant() - 1)"
              />
              <p-button
                icon="tb-i tb-i-chevron_right"
                severity="secondary"
                [text]="true"
                [rounded]="true"
                [ariaLabel]="t.next"
                [disabled]="variant() >= history().length - 1"
                (onClick)="show(variant() + 1)"
              />
            </header>
            <div class="tb-ai-pane__draft-body">
              <h4 class="tb-ai-pane__draft-title">{{ current.title }}</h4>
              <tb-markdown [text]="current.description" />
            </div>
            <div class="tb-ai-pane__draft-actions">
              <p-button
                [label]="t.insertInto"
                icon="tb-i tb-i-arrow_back"
                severity="secondary"
                (onClick)="apply(current, hasText() ? 'insert' : 'replace')"
              />
              <p-button
                [label]="t.moreVariant"
                icon="tb-i tb-i-refresh"
                severity="secondary"
                [text]="true"
                [loading]="pending()"
                (onClick)="generate()"
              />
            </div>
          </section>
        }
        @if (mode() === 'QUESTIONS' && questions(); as drafted) {
          <section class="tb-ai-pane__draft" [attr.aria-label]="t.questionsDraft">
            <header class="tb-ai-pane__draft-header">
              <span class="tb-ai-pane__badge">{{ t.questionsDraft }}</span>
              <span class="tb-ai-pane__grow"></span>
              <span class="tb-hint">{{ t.questionsCount(drafted.length) }}</span>
            </header>
            <ol class="tb-ai-pane__draft-body tb-ai-pane__questions">
              @for (question of drafted; track question.id) {
                <li>
                  <span class="tb-hint">{{ t.types[question.type] }}</span>
                  {{ question.text }}
                </li>
              } @empty {
                <li class="tb-hint">{{ t.questionsEmpty }}</li>
              }
            </ol>
            @if (quizLocked()) {
              <p-message severity="warn" styleClass="tb-form-message">{{
                t.questionsLocked
              }}</p-message>
            }
            <div class="tb-ai-pane__draft-actions">
              @if (drafted.length > 0) {
                <p-button
                  [label]="t.questionsToTest"
                  icon="tb-i tb-i-arrow_back"
                  severity="secondary"
                  [disabled]="quizLocked()"
                  (onClick)="applyQuestions(drafted, 'append')"
                />
              }
              <p-button
                [label]="t.moreVariant"
                icon="tb-i tb-i-refresh"
                severity="secondary"
                [text]="true"
                [loading]="pending()"
                (onClick)="generate()"
              />
            </div>
          </section>
        }

        <footer class="tb-ai-pane__foot">
          <small class="tb-hint tb-ai-pane__grow">{{ t.onlyOnInsert }}</small>
          <button
            type="button"
            class="tb-ai-pane__generate"
            [disabled]="pending()"
            (click)="generate()"
          >
            <i class="tb-i tb-i-auto_awesome" aria-hidden="true"></i>{{ t.generate }}
          </button>
        </footer>
      </section>
    } @else {
      <section class="tb-ai-panel" [attr.aria-label]="t.title">
        <p-selectbutton
          class="tb-ai-panel__mode"
          [options]="modes"
          optionLabel="label"
          optionValue="value"
          [allowEmpty]="false"
          [ngModel]="mode()"
          (ngModelChange)="mode.set($event)"
          [ariaLabel]="t.modeLabel"
        />
        <div class="tb-ai-panel__request" [class.tb-ai-panel__request--folded]="folded()">
          <i class="tb-i tb-i-auto_awesome tb-ai-panel__mark" aria-hidden="true"></i>
          <textarea
            pTextarea
            id="ai-prompt"
            class="tb-ai-panel__prompt"
            [formControl]="prompt"
            rows="2"
            [attr.aria-label]="t.prompt"
            [placeholder]="mode() === 'TASK' ? t.placeholder : t.questionsPlaceholder"
            (focus)="focused.set(true)"
            (blur)="focused.set(false)"
          ></textarea>
        </div>
        <div class="tb-ai-panel__actions">
          <p-button
            [label]="t.prompts"
            icon="tb-i tb-i-bookmark"
            severity="secondary"
            ariaHasPopup="dialog"
            (onClick)="prompts.toggle($event)"
          />
          @if (sources().length > 0) {
            <p-button
              [label]="picked().length > 0 ? t.sourcesCount(picked().length) : t.sources"
              icon="tb-i tb-i-menu_book"
              severity="secondary"
              ariaHasPopup="dialog"
              (onClick)="sourcePicker.toggle($event)"
            />
          }
          <p-button
            class="tb-ai-panel__generate"
            [label]="shown() === null ? t.generate : t.again"
            [icon]="shown() === null ? 'tb-i tb-i-auto_awesome' : 'tb-i tb-i-refresh'"
            [loading]="pending()"
            (onClick)="generate()"
          />
        </div>

        <p-popover #sourcePicker [ariaLabel]="t.sources">
          <fieldset class="tb-ai-panel__sources">
            <legend class="tb-sr-only">{{ t.sources }}</legend>
            @for (option of sources(); track option.key) {
              <div class="tb-ai-panel__source">
                <p-checkbox
                  [inputId]="'ai-source-' + option.key"
                  [binary]="true"
                  [ngModel]="chosen().has(option.key)"
                  (ngModelChange)="toggle(option.key, $event)"
                />
                <label [for]="'ai-source-' + option.key">{{ option.label }}</label>
              </div>
            }
            <small class="tb-hint">{{ t.sourcesHint }}</small>
          </fieldset>
        </p-popover>

        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
        @if (mode() === 'TASK' && draft(); as current) {
          <section class="tb-ai-panel__draft" [attr.aria-label]="t.draft">
            <header class="tb-ai-panel__draft-header">
              <span class="tb-ai-panel__badge">{{ t.draft }}</span>
              <h3 class="tb-ai-panel__draft-title">{{ current.title }}</h3>
              <div class="tb-actions">
                <p-button
                  [label]="t.discard"
                  severity="secondary"
                  [text]="true"
                  (onClick)="discard()"
                />
                @if (hasText()) {
                  <p-button
                    [label]="t.insert"
                    severity="secondary"
                    (onClick)="apply(current, 'insert')"
                  />
                }
                <p-button
                  [label]="t.replace"
                  icon="tb-i tb-i-check"
                  (onClick)="apply(current, 'replace')"
                />
              </div>
            </header>
            <div class="tb-ai-panel__draft-body">
              <tb-markdown [text]="current.description" />
            </div>
            <small class="tb-hint tb-ai-panel__draft-hint">{{ t.hint }}</small>
          </section>
        }
        @if (mode() === 'QUESTIONS' && questions(); as drafted) {
          <section class="tb-ai-panel__draft" [attr.aria-label]="t.questionsDraft">
            <header class="tb-ai-panel__draft-header">
              <span class="tb-ai-panel__badge">{{ t.questionsDraft }}</span>
              <h3 class="tb-ai-panel__draft-title">{{ t.questionsCount(drafted.length) }}</h3>
              <div class="tb-actions">
                <p-button
                  [label]="t.discard"
                  severity="secondary"
                  [text]="true"
                  (onClick)="questions.set(null)"
                />
                @if (drafted.length > 0) {
                  @if (questionCount() > 0) {
                    <p-button
                      [label]="t.questionsAppend"
                      severity="secondary"
                      [disabled]="quizLocked()"
                      (onClick)="applyQuestions(drafted, 'append')"
                    />
                  }
                  <p-button
                    [label]="questionCount() > 0 ? t.questionsReplace : t.questionsAppend"
                    icon="tb-i tb-i-check"
                    [disabled]="quizLocked()"
                    (onClick)="applyQuestions(drafted, questionCount() > 0 ? 'replace' : 'append')"
                  />
                }
              </div>
            </header>
            @if (quizLocked()) {
              <p-message severity="warn" styleClass="tb-form-message">{{
                t.questionsLocked
              }}</p-message>
            }
            @if (drafted.length === 0) {
              <p class="tb-hint tb-ai-panel__draft-hint">{{ t.questionsEmpty }}</p>
            } @else {
              <ol class="tb-ai-panel__questions">
                @for (question of drafted; track question.id) {
                  <li class="tb-ai-panel__question">
                    <span class="tb-ai-panel__question-meta">
                      {{ t.types[question.type] }} · {{ t.points(question.points) }}
                    </span>
                    <span class="tb-ai-panel__question-text">{{ question.text }}</span>
                    <small class="tb-hint tb-ai-panel__question-key">{{ key(question) }}</small>
                  </li>
                }
              </ol>
            }
            <small class="tb-hint tb-ai-panel__draft-hint">{{ t.questionsHint }}</small>
          </section>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    :host([hidden]) {
      display: none;
    }

    .tb-ai-panel {
      display: grid;
      gap: var(--tb-space-2);
      padding: var(--tb-space-3);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-high);
    }

    .tb-ai-panel__request {
      display: flex;
      gap: var(--tb-space-2);
      align-items: flex-start;
    }

    .tb-ai-panel__mark {
      margin-top: var(--tb-space-3);
      color: var(--p-md-primary);
    }

    .tb-ai-panel__prompt {
      flex: 1;
      min-width: 0;
      min-height: 4.5rem;
      max-height: 12rem;
      background: var(--p-md-surface-container-lowest);
      field-sizing: content;
      resize: none;
    }

    /* While a draft is shown, the request takes one line until the teacher comes back to it */
    .tb-ai-panel__request--folded .tb-ai-panel__prompt {
      min-height: 0;
      max-height: 2.75rem;
      overflow: hidden;
    }

    .tb-ai-panel__actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      align-items: center;
      padding-left: var(--tb-space-6);
    }

    .tb-ai-panel__generate {
      margin-left: auto;
    }

    .tb-ai-panel__menu {
      display: grid;
      gap: var(--tb-space-2);
      width: min(24rem, calc(100vw - 4rem));
    }

    .tb-ai-panel__search {
      width: 100%;
    }

    .tb-ai-panel__library {
      display: grid;
      max-height: 16rem;
      overflow: auto;
    }

    .tb-ai-panel__menu-actions {
      display: grid;
      justify-items: start;
      padding-top: var(--tb-space-2);
      border-top: 1px solid var(--p-md-outline-variant);
    }

    .tb-ai-panel__end {
      justify-content: flex-end;
    }

    .tb-ai-panel__option {
      display: grid;
      min-width: 0;
      padding: var(--tb-space-2) var(--tb-space-3);
      border: 0;
      border-radius: var(--tb-shape-md);
      background: transparent;
      color: var(--p-md-on-surface);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    .tb-ai-panel__option:hover {
      background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
    }

    .tb-ai-panel__option:focus-visible {
      outline: 3px solid var(--p-md-secondary);
      outline-offset: -3px;
    }

    .tb-ai-panel__option small {
      overflow: hidden;
      color: var(--p-md-on-surface-variant);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tb-ai-panel__sources {
      display: grid;
      gap: var(--tb-space-2);
      max-width: 22rem;
      margin: 0;
      padding: 0;
      border: 0;
    }

    .tb-ai-panel__source {
      display: flex;
      gap: var(--tb-space-2);
      align-items: center;
    }

    .tb-ai-panel__draft {
      display: grid;
      border: 1px dashed var(--p-md-primary);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-surface);
    }

    .tb-ai-panel__draft-header {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      align-items: center;
      padding: var(--tb-space-2) var(--tb-space-3);
      border-bottom: 1px solid var(--p-md-outline-variant);
    }

    .tb-ai-panel__badge {
      padding: var(--tb-space-1) var(--tb-space-2);
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);
      font: var(--tb-type-label-m);
    }

    .tb-ai-panel__draft-title {
      flex: 1;
      min-width: 10rem;
      margin: 0;
      font: var(--tb-type-title-m);
    }

    .tb-ai-panel__draft-body {
      max-height: 24rem;
      overflow: auto;
      padding: var(--tb-space-3);
    }

    .tb-ai-panel__draft-hint {
      padding: 0 var(--tb-space-3) var(--tb-space-2);
    }

    .tb-ai-panel__mode {
      justify-self: start;
      max-width: 100%;
    }

    .tb-ai-panel__questions {
      display: grid;
      gap: var(--tb-space-2);
      max-height: 24rem;
      margin: 0;
      overflow: auto;
      padding: var(--tb-space-3) var(--tb-space-3) var(--tb-space-3) var(--tb-space-6);
    }

    .tb-ai-panel__question {
      min-width: 0;
      padding-left: var(--tb-space-1);
      overflow-wrap: anywhere;
    }

    .tb-ai-panel__question-meta {
      display: block;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-ai-pane {
      display: grid;
      gap: var(--tb-space-4);
      align-content: start;
    }

    .tb-ai-pane__mode {
      width: 100%;
    }

    .tb-ai-pane__prompt {
      width: 100%;
      max-height: 12rem;
      resize: none;
      field-sizing: content;
      background: var(--p-md-surface-container-lowest);
    }

    .tb-ai-pane__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      margin-top: var(--tb-space-2);
    }

    .tb-ai-pane__sources {
      display: grid;
      gap: var(--tb-space-2);
      justify-items: start;
    }

    .tb-ai-pane__label {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
    }

    .tb-ai-pane__source {
      display: flex;
      gap: var(--tb-space-3);
      align-items: center;
      width: 100%;
      box-sizing: border-box;
      padding: var(--tb-space-2) var(--tb-space-3);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-surface-container-lowest);
      font: var(--tb-type-body-m);
      cursor: pointer;

      .tb-i {
        color: var(--p-md-primary);
        font-size: 1.25rem;
      }
    }

    .tb-ai-pane__source-name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .tb-ai-pane__draft {
      display: grid;
      gap: var(--tb-space-3);
      padding: var(--tb-space-3) var(--tb-space-4);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-lowest);
    }

    .tb-ai-pane__draft-header,
    .tb-ai-pane__draft-actions,
    .tb-ai-pane__foot {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      align-items: center;
    }

    .tb-ai-pane__grow {
      flex: 1;
    }

    .tb-ai-pane__badge {
      padding: var(--tb-space-1) var(--tb-space-2);
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
      font: var(--tb-type-label-m);
    }

    .tb-ai-pane__draft-body {
      max-height: 16rem;
      margin: 0;
      overflow: auto;
      font: var(--tb-type-body-m);
    }

    .tb-ai-pane__draft-title {
      margin: 0 0 var(--tb-space-1);
      font: var(--tb-type-title-s);
    }

    .tb-ai-pane__questions {
      padding-inline-start: var(--tb-space-6);
    }

    .tb-ai-pane__foot {
      margin-top: auto;
    }

    /* the AI action takes the tertiary role (sketch AiDraft), not the primary one */
    .tb-ai-pane__generate {
      display: inline-flex;
      gap: var(--tb-space-2);
      align-items: center;
      block-size: 2.5rem;
      padding: 0 var(--tb-space-5) 0 var(--tb-space-4);
      border: 0;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-on-tertiary-container);
      color: var(--p-md-tertiary-container);
      font: var(--tb-type-label-l);
      cursor: pointer;

      &:disabled {
        opacity: 0.38;
        cursor: default;
      }
    }

    .tb-ai-panel__question-text {
      display: block;
      font: var(--tb-type-body-m);
    }
  `,
})
export class HomeworkAiPanel implements OnInit {
  protected readonly t = T.panel;
  private readonly api = inject(AiApi);
  private readonly snackbar = inject(Snackbar);
  private readonly menu = viewChild<Popover>('prompts');

  /** What the teacher already called the assignment. */
  readonly title = input('');
  /** The assignment has text a draft could go after. */
  readonly hasText = input(false);
  /** Textbook pages and files (saved or just picked) the draft may be based on. */
  readonly sources = input<readonly SourceOption[]>([]);
  /** How many questions the quiz already has: «Добавить» appears only when there are some. */
  readonly questionCount = input(0);
  /** A student started the quiz: its questions cannot change. */
  readonly quizLocked = input(false);
  /** The pane of the quick dialog (sketch «Написать с ИИ») instead of the editor's card. */
  readonly pane = input(false);
  /** «Источник»: the host adds a source (a textbook) to the assignment. */
  readonly sourceAdd = output();
  readonly applied = output<AppliedDraft>();
  readonly questionsApplied = output<AppliedQuestions>();

  private readonly state = inject(HomeworkAiState, { optional: true }) ?? new HomeworkAiState();
  readonly prompt = this.state.prompt;
  readonly promptTitle = this.state.promptTitle;
  protected readonly library = this.state.library;
  protected readonly query = this.state.query;
  protected readonly found = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return query === ''
      ? this.library()
      : this.library().filter((prompt) =>
          `${prompt.title} ${prompt.text}`.toLocaleLowerCase().includes(query),
        );
  });
  protected readonly mode = this.state.mode;
  protected readonly modes = [
    { label: this.t.modeTask, value: 'TASK' },
    { label: this.t.modeQuestions, value: 'QUESTIONS' },
  ];
  protected readonly paneModes: Segment<AiMode>[] = [
    { label: this.t.paneTask, value: 'TASK' },
    { label: this.t.paneQuestions, value: 'QUESTIONS' },
  ];
  protected readonly suggestions = [
    { label: this.t.suggestTopic, text: this.t.suggestTopicText },
    { label: this.t.suggestEssay, text: this.t.suggestEssayText },
    { label: this.t.suggestBook, text: this.t.suggestBookText },
  ];
  protected readonly draft = this.state.draft;
  protected readonly history = this.state.history;
  protected readonly variant = this.state.variant;
  protected readonly questions = this.state.questions;
  /** The draft of the chosen mode, if there is one. */
  protected readonly shown = computed(() =>
    this.mode() === 'TASK' ? this.draft() : this.questions(),
  );
  protected readonly chosen = this.state.chosen;
  /** The chosen sources still offered: a file taken off the assignment drops out. */
  protected readonly picked = computed(() =>
    this.sources().filter((option) => this.chosen().has(option.key)),
  );
  protected readonly pending = this.state.pending;
  protected readonly naming = this.state.naming;
  protected readonly saving = this.state.saving;
  protected readonly error = this.state.error;
  protected readonly focused = this.state.focused;
  /** The request folds to a line while the teacher looks at a draft. */
  protected readonly folded = computed(() => this.shown() !== null && !this.focused());

  ngOnInit(): void {
    this.api.prompts().subscribe({
      next: (prompts) => {
        this.library.set(prompts);
      },
      error: () => {
        // without the library the field still works
      },
    });
  }

  toggle(key: string, on: boolean): void {
    this.chosen.update((chosen) => {
      const next = new Set(chosen);
      if (on) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  protected use(prompt: SavedPrompt | null): void {
    if (prompt !== null) {
      this.prompt.setValue(prompt.text);
      this.menu()?.hide();
    }
  }

  generate(): void {
    const prompt = this.prompt.value.trim();
    if (prompt === '' || this.prompt.invalid || this.pending()) {
      this.prompt.markAsTouched();
      return;
    }
    const title = this.title().trim();
    this.pending.set(true);
    this.error.set(null);
    const picked = this.picked().map((option) => option.source);
    const files = picked.filter((source): source is File => source instanceof File);
    const brief = {
      prompt,
      title: title === '' ? null : title,
      sources: picked.filter((source): source is DraftSource => !(source instanceof File)),
    };
    const failed = (error: unknown): void => {
      this.pending.set(false);
      this.error.set(describeError(error, T.panel.failed));
    };
    if (this.mode() === 'TASK') {
      this.api.homeworkDraft(brief, files).subscribe({
        next: (draft) => {
          this.pending.set(false);
          this.history.update((variants) => [...variants, draft]);
          this.variant.set(this.history().length - 1);
          this.draft.set(draft);
        },
        error: failed,
      });
    } else {
      this.api.quizDraft(brief, files).subscribe({
        next: ({ questions }) => {
          this.pending.set(false);
          this.questions.set(questions);
        },
        error: failed,
      });
    }
  }

  /** What is right in a question, in a line, for the teacher's review. */
  protected key(question: DraftedQuestion): string {
    const text = (id: string): string => question.options.find((o) => o.id === id)?.text ?? '';
    switch (question.type) {
      case 'SINGLE_CHOICE':
      case 'MULTIPLE_CHOICE':
        return question.correct.map(text).join('; ');
      case 'ORDERING':
        return question.options.map((option) => option.text).join(' → ');
      case 'MATCHING':
        return question.pairs.map((pair) => `${pair.left} — ${pair.right}`).join('; ');
      case 'NUMBER':
        return String(question.value ?? '');
      case 'SHORT_TEXT':
        return question.accepted.join('; ');
    }
  }

  protected applyQuestions(
    questions: readonly DraftedQuestion[],
    mode: 'replace' | 'append',
  ): void {
    this.questionsApplied.emit({ questions, mode });
    this.questions.set(null);
  }

  protected apply(draft: HomeworkDraft, mode: 'replace' | 'insert'): void {
    this.applied.emit({ draft, mode });
    this.discard();
  }

  protected discard(): void {
    this.draft.set(null);
    this.history.set([]);
    this.variant.set(0);
  }

  protected show(index: number): void {
    this.variant.set(index);
    this.draft.set(this.history()[index] ?? null);
  }

  protected startNaming(): void {
    this.promptTitle.setValue(this.prompt.value.trim().split('\n')[0]?.slice(0, 100) ?? '');
    this.naming.set(true);
  }

  savePrompt(): void {
    const title = this.promptTitle.value.trim();
    if (title === '' || this.promptTitle.invalid || this.saving()) {
      this.promptTitle.markAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.savePrompt({ title, text: this.prompt.value.trim() }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.naming.set(false);
        this.menu()?.hide();
        this.library.update((prompts) =>
          [...prompts, saved].sort((a, b) => a.title.localeCompare(b.title)),
        );
        this.snackbar.success(T.panel.saved);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(describeError(error, T.library.failed));
      },
    });
  }
}
