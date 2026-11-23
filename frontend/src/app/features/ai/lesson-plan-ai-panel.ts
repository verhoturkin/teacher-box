import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { MarkdownView } from '@shared/ui/markdown-view';
import { AiApi } from './data-access/ai-api';
import { DraftSource, LessonFacts, LessonPlanDraft, SourceOption } from './data-access/ai.models';
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
    FormsModule,
    ReactiveFormsModule,
    Button,
    Checkbox,
    Message,
    Textarea,
    MarkdownView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
          <p-button
            [label]="pending() ? t.generating : draft() === null ? t.generate : t.again"
            [icon]="draft() === null ? 'tb-i tb-i-auto_awesome' : 'tb-i tb-i-refresh'"
            [loading]="pending()"
            (onClick)="generate()"
          />
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
  `,
})
export class LessonPlanAiPanel {
  protected readonly t = T.planPanel;
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
  private readonly chosen = this.state.chosen;
  /** Until the teacher chooses, every source is read. */
  private readonly picked = computed(() =>
    this.sources().filter((option) => this.isChosen(option.key)),
  );

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
