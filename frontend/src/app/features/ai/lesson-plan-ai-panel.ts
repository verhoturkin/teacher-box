import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective, ButtonIcon, ButtonLabel, Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Message } from 'primeng/message';
import { Popover } from 'primeng/popover';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { AssistChip } from '@shared/ui/assist-chip';
import { MarkdownView } from '@shared/ui/markdown-view';
import { SearchField } from '@shared/ui/search-field';
import { AiApi } from './data-access/ai-api';
import {
  DraftSource,
  LessonFacts,
  LessonPlanDraft,
  SavedPrompt,
  SourceOption,
} from './data-access/ai.models';
import { T } from './i18n/texts';
import { AiModelPick } from './ai-model-pick';
import { AiModelChoice } from './model-choice';
import { AiContextChips, StudentContext } from './student-context';

/** A draft the teacher took: it replaces the plan's text or goes after it. */
export interface AppliedPlan {
  readonly draft: LessonPlanDraft;
  readonly mode: 'replace' | 'insert';
}

/** State belongs to the editor so closing the pane keeps ongoing work. */
@Injectable()
export class LessonPlanAiState {
  readonly prompt = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(4_000)],
  });
  readonly library = signal<SavedPrompt[]>([]);
  readonly query = signal('');
  readonly draft = signal<LessonPlanDraft | null>(null);
  /** Keys of the chosen sources; `null` — the teacher has not chosen yet, all are taken. */
  readonly chosen = signal<ReadonlySet<string> | null>(null);
  readonly pending = signal(false);
  readonly error = signal<string | null>(null);
  readonly context = new StudentContext();
}

/**
 * The AI assistant of the plan editor (464.2), the pane of `HomeworkAiPanel` for a lesson plan: a request
 * in the teacher's words, the sources it reads (the plan's textbook pages and videos), the lesson it knows (the
 * students' AI tags, the topic, the previous summary) — and a draft. Nothing reaches the plan until the teacher
 * says so.
 */
@Component({
  selector: 'tb-lesson-plan-ai-panel',
  imports: [
    AiContextChips,
    AiModelPick,
    AssistChip,
    SearchField,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Checkbox,
    Message,
    Popover,
    Textarea,
    MarkdownView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- the homework assistant's prompt library: a saved prompt becomes the request -->
    <p-popover #prompts [ariaLabel]="p.prompts" (onHide)="query.set('')">
      <div class="tb-plan-ai__menu">
        @if (library().length > 0) {
          <tb-search-field
            class="tb-plan-ai__search"
            [label]="p.search"
            [ngModel]="query()"
            (ngModelChange)="query.set($event)"
          />
          <div class="tb-plan-ai__library" role="group" [attr.aria-label]="p.prompts">
            @for (saved of found(); track saved.id) {
              <button type="button" class="tb-plan-ai__option" (click)="use(saved)">
                <span>{{ saved.title }}</span>
                <small>{{ saved.text }}</small>
              </button>
            } @empty {
              <p class="tb-hint">{{ p.notFound }}</p>
            }
          </div>
        } @else {
          <p class="tb-hint">{{ p.noPrompts }}</p>
        }
        <div class="tb-plan-ai__menu-actions">
          <a
            pButton
            routerLink="/teacher/settings/ai"
            fragment="prompt-library"
            severity="secondary"
            [text]="true"
          >
            <i pButtonIcon aria-hidden="true" class="tb-i tb-i-settings"></i>
            <span pButtonLabel>{{ p.manage }}</span>
          </a>
        </div>
      </div>
    </p-popover>

    <section class="tb-plan-ai" [attr.aria-label]="t.title">
      <div class="tb-field">
        <label for="plan-ai-prompt">{{ t.need }}</label>
        <textarea
          pTextarea
          id="plan-ai-prompt"
          class="tb-plan-ai__prompt"
          [formControl]="prompt"
          rows="3"
          [placeholder]="t.placeholder"
        ></textarea>
        <div class="tb-plan-ai__chips">
          <tb-assist-chip icon="bookmarks" (click)="prompts.toggle($event)">{{
            p.myPrompts
          }}</tb-assist-chip>
        </div>
      </div>

      <tb-ai-context-chips [state]="context" [students]="students()" [row]="compact()" />

      @if (lesson(); as facts) {
        @if (facts.topic !== null || facts.previousSummary !== null) {
          <div class="tb-plan-ai__lesson">
            <span class="tb-plan-ai__label">{{ t.lessonKnows }}</span>
            @if (facts.topic !== null) {
              <small>{{ t.topic(facts.topic) }}</small>
            }
            @if (facts.previousSummary !== null) {
              <small>{{ t.previousSummary }}</small>
            }
          </div>
        }
      }

      <div class="tb-plan-ai__sources">
        <span class="tb-plan-ai__label">{{ t.considers }}</span>
        @for (option of sources(); track option.key) {
          <div class="tb-plan-ai__source">
            <label class="tb-plan-ai__source-name" [for]="'plan-ai-' + option.key">{{
              option.label
            }}</label>
            <p-checkbox
              [inputId]="'plan-ai-' + option.key"
              [binary]="true"
              [ngModel]="isChosen(option.key)"
              (ngModelChange)="toggle(option.key, $event)"
            />
          </div>
        } @empty {
          <small class="tb-hint">{{ t.noSources }}</small>
        }
      </div>

      @if (error(); as message) {
        <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
      }
      @if (draft(); as current) {
        <section class="tb-plan-ai__draft" [attr.aria-label]="t.draft">
          <header class="tb-plan-ai__draft-head">
            <span class="tb-plan-ai__badge">{{ t.draft }}</span>
          </header>
          <div class="tb-plan-ai__draft-body">
            <h4 class="tb-plan-ai__draft-title">{{ current.title }}</h4>
            <tb-markdown [text]="current.body" />
            @if (current.textbooks.length > 0) {
              <small class="tb-hint">{{ t.pagesHint }}</small>
            }
          </div>
          <div class="tb-plan-ai__actions">
            <p-button
              [label]="hasText() ? t.insert : t.replace"
              icon="tb-i tb-i-arrow_back"
              severity="secondary"
              (onClick)="apply(current, hasText() ? 'insert' : 'replace')"
            />
            @if (hasText()) {
              <p-button
                [label]="t.replace"
                severity="secondary"
                [text]="true"
                (onClick)="apply(current, 'replace')"
              />
            }
            <p-button
              [label]="t.discard"
              severity="secondary"
              [text]="true"
              (onClick)="draft.set(null)"
            />
          </div>
        </section>
      }

      <footer class="tb-plan-ai__foot">
        <small class="tb-hint tb-plan-ai__grow">{{ t.onlyOnInsert }}</small>
        <span class="tb-plan-ai__run">
          <tb-ai-model-pick [short]="compact()" />
          <button
            type="button"
            class="tb-plan-ai__generate"
            [disabled]="pending()"
            [attr.aria-busy]="pending()"
            (click)="generate()"
          >
            <i
              class="tb-i"
              [class.tb-i-auto_awesome]="!pending() && draft() === null"
              [class.tb-i-refresh]="!pending() && draft() !== null"
              [class.tb-i-progress_activity]="pending()"
              [class.tb-plan-ai__spin]="pending()"
              aria-hidden="true"
            ></i
            >{{ pending() ? t.generating : draft() === null ? t.generate : t.again }}
          </button>
        </span>
      </footer>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .tb-plan-ai {
      display: grid;
      gap: var(--tb-space-4);
      align-content: start;
    }

    .tb-plan-ai__prompt {
      width: 100%;
      max-height: 12rem;
      resize: none;
      field-sizing: content;
      background: var(--p-md-surface-container-lowest);
    }

    .tb-plan-ai__lesson,
    .tb-plan-ai__sources {
      display: grid;
      gap: var(--tb-space-2);
      justify-items: start;
    }

    .tb-plan-ai__label {
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-label-m);
      letter-spacing: var(--tb-tracking-label-m);
    }

    .tb-plan-ai__source {
      display: flex;
      gap: var(--tb-space-3);
      align-items: center;
      width: 100%;
      box-sizing: border-box;
      padding: var(--tb-space-2) var(--tb-space-3);
      border-radius: var(--tb-shape-md);
      background: var(--p-md-surface-container-lowest);
      font: var(--tb-type-body-m);
      letter-spacing: var(--tb-tracking-body-m);
    }

    .tb-plan-ai__source-name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .tb-plan-ai__draft {
      display: grid;
      gap: var(--tb-space-3);
      padding: var(--tb-space-3) var(--tb-space-4);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-surface-container-lowest);
    }

    .tb-plan-ai__draft-head,
    .tb-plan-ai__actions,
    .tb-plan-ai__foot {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      align-items: center;
    }

    .tb-plan-ai__badge {
      padding: var(--tb-space-1) var(--tb-space-2);
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
      font: var(--tb-type-label-m);
      letter-spacing: var(--tb-tracking-label-m);
    }

    .tb-plan-ai__draft-body {
      max-height: 20rem;
      overflow: auto;
      font: var(--tb-type-body-m);
      letter-spacing: var(--tb-tracking-body-m);
    }

    .tb-plan-ai__draft-title {
      margin: 0 0 var(--tb-space-1);
      font: var(--tb-type-title-s);
      letter-spacing: var(--tb-tracking-title-s);
    }

    .tb-plan-ai__grow {
      flex: 1;
    }

    .tb-plan-ai__run {
      display: flex;
      gap: var(--tb-space-2);
      align-items: center;
      margin-inline-start: auto;
    }

    .tb-plan-ai__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      margin-top: var(--tb-space-2);
    }

    .tb-plan-ai__menu {
      display: grid;
      gap: var(--tb-space-2);
      width: min(24rem, calc(100vw - 4rem));
    }

    .tb-plan-ai__search {
      width: 100%;
    }

    .tb-plan-ai__library {
      display: grid;
      max-height: 16rem;
      overflow: auto;
    }

    .tb-plan-ai__menu-actions {
      display: grid;
      justify-items: start;
      padding-top: var(--tb-space-2);
      border-top: 1px solid var(--p-md-outline-variant);
    }

    .tb-plan-ai__option {
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

    .tb-plan-ai__option:hover {
      background: color-mix(in srgb, var(--p-md-on-surface) var(--tb-state-hover), transparent);
    }

    .tb-plan-ai__option:focus-visible {
      outline: 3px solid var(--p-md-secondary);
      outline-offset: -3px;
    }

    .tb-plan-ai__option small {
      overflow: hidden;
      color: var(--p-md-on-surface-variant);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* the AI action as in the homework pane: the tertiary role; the indicator turns while it works */
    .tb-plan-ai__generate {
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
      letter-spacing: var(--tb-tracking-label-l);
      cursor: pointer;

      &:disabled {
        opacity: 0.38;
        cursor: default;
      }
    }

    .tb-plan-ai__spin {
      animation: tb-plan-ai-spin 1s linear infinite;
    }

    @keyframes tb-plan-ai-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .tb-plan-ai__spin {
        animation: none;
      }
    }
  `,
})
export class LessonPlanAiPanel implements OnInit {
  protected readonly t = T.planPanel;
  protected readonly p = T.panel;
  private readonly menu = viewChild<Popover>('prompts');
  private readonly api = inject(AiApi);
  private readonly model = inject(AiModelChoice);

  /** The plan has text a draft could go after. */
  readonly hasText = input(false);
  /** Textbook pages and transcribed videos of the plan. */
  readonly sources = input<readonly SourceOption[]>([]);
  /** The lesson's students: their AI tags go with the request. */
  readonly students = input<readonly string[]>([]);
  /** What the lesson tells about the plan; `null` — a plan of the bank. */
  readonly lesson = input<LessonFacts | null>(null);
  /** The name of the plan's course. */
  readonly courseName = input<string | null>(null);
  /** The phone sheet: the context chips take one scrolling row. */
  readonly compact = input(false);
  readonly applied = output<AppliedPlan>();

  private readonly state = inject(LessonPlanAiState, { optional: true }) ?? new LessonPlanAiState();
  readonly prompt = this.state.prompt;
  protected readonly draft = this.state.draft;
  protected readonly pending = this.state.pending;
  protected readonly error = this.state.error;
  protected readonly context = this.state.context;
  protected readonly library = this.state.library;
  protected readonly query = this.state.query;
  protected readonly found = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.library().filter((saved) =>
      `${saved.title} ${saved.text}`.toLocaleLowerCase().includes(query),
    );
  });
  private readonly chosen = this.state.chosen;
  /** Until the teacher chooses, every source is read. */
  private readonly picked = computed(() =>
    this.sources().filter((option) => this.isChosen(option.key)),
  );

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

  protected use(saved: SavedPrompt): void {
    this.prompt.setValue(saved.text);
    this.menu()?.hide();
  }

  protected isChosen(key: string): boolean {
    return this.chosen()?.has(key) ?? true;
  }

  toggle(key: string, on: boolean): void {
    const next = new Set(this.chosen() ?? this.sources().map((option) => option.key));
    if (on) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.chosen.set(next);
  }

  generate(): void {
    const prompt = this.prompt.value.trim();
    if (prompt === '' || this.prompt.invalid || this.pending()) {
      this.prompt.markAsTouched();
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    const sources = this.picked()
      .map((option) => option.source)
      .filter((source): source is DraftSource => !(source instanceof File));
    const lesson = this.lesson();
    const course = this.courseName();
    const brief = {
      prompt,
      ...(course === null ? {} : { courseName: course }),
      ...(lesson === null ? {} : { lesson }),
      sources,
      context: this.context.context(this.students()),
    };
    this.model
      .send((modelId) => this.api.lessonPlanDraft({ ...brief, modelId }))
      .subscribe({
        next: (draft) => {
          this.pending.set(false);
          this.draft.set(draft);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.planPanel.failed));
        },
      });
  }

  protected apply(draft: LessonPlanDraft, mode: 'replace' | 'insert'): void {
    this.applied.emit({ draft, mode });
    this.draft.set(null);
  }
}
