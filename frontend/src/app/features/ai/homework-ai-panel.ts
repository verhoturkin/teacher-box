import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { MarkdownView } from '@shared/ui/markdown-view';
import { AiApi } from './data-access/ai-api';
import { HomeworkDraft, HomeworkKind, SavedPrompt, SourceOption } from './data-access/ai.models';
import { T } from './i18n/texts';
import { currentPageLook } from './page-look';

/** A draft the teacher took: it replaces the assignment's content or goes after its text. */
export interface AppliedDraft {
  readonly draft: HomeworkDraft;
  readonly mode: 'replace' | 'insert';
}

/** Prompts offered as one-click chips above the field. */
const QUICK_PROMPTS = 4;

/**
 * The AI assistant beside the assignment editor: a request in the teacher's words (typed, or taken from the prompt
 * library), the draft it brings, and what to do with it. Nothing reaches the assignment until the teacher says so.
 */
@Component({
  selector: 'tb-homework-ai-panel',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Button,
    Card,
    Checkbox,
    InputText,
    Message,
    Select,
    Textarea,
    MarkdownView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      <div class="tb-form">
        @if (choices().length > 0) {
          @if (quick().length > 0) {
            <div class="tb-ai-panel__chips" role="group" [attr.aria-label]="t.library">
              @for (prompt of quick(); track prompt.id) {
                <p-button
                  [label]="prompt.title"
                  size="small"
                  severity="secondary"
                  [rounded]="true"
                  (onClick)="use(prompt)"
                />
              }
            </div>
          }
          <div class="tb-field">
            <label for="ai-library">{{ t.library }}</label>
            <p-select
              inputId="ai-library"
              [options]="choices()"
              optionLabel="title"
              [placeholder]="t.libraryPlaceholder"
              [filter]="choices().length > 8"
              filterBy="title,text"
              appendTo="body"
              [fluid]="true"
              (onChange)="use($event.value)"
            />
          </div>
        }
        @if (sources().length > 0) {
          <fieldset class="tb-ai-panel__sources">
            <legend>{{ t.sources }}</legend>
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
        }
        <div class="tb-field">
          <label for="ai-prompt">{{ t.prompt }}</label>
          <textarea
            pTextarea
            id="ai-prompt"
            [formControl]="prompt"
            rows="5"
            [placeholder]="t.placeholders[kind()]"
          ></textarea>
          <small class="tb-hint">{{ t.hint }}</small>
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
        @if (naming()) {
          <div class="tb-field">
            <label for="ai-prompt-title">{{ t.promptTitle }}</label>
            <input pInputText id="ai-prompt-title" [formControl]="promptTitle" autocomplete="off" />
          </div>
          <div class="tb-actions">
            <p-button
              [label]="t.cancel"
              severity="secondary"
              [text]="true"
              (onClick)="naming.set(false)"
            />
            <p-button [label]="t.save" [loading]="saving()" (onClick)="savePrompt()" />
          </div>
        } @else {
          <div class="tb-actions">
            <p-button
              [label]="t.savePrompt"
              icon="pi pi-bookmark"
              severity="secondary"
              [text]="true"
              [disabled]="prompt.value.trim() === ''"
              (onClick)="startNaming()"
            />
            <p-button
              [label]="t.generate"
              icon="pi pi-sparkles"
              [loading]="pending()"
              (onClick)="generate()"
            />
          </div>
        }
        @if (draft(); as current) {
          <section class="tb-ai-panel__draft" [attr.aria-label]="t.draft">
            <h3 class="tb-subtitle">{{ current.title }}</h3>
            @if (current.html !== null) {
              <p class="tb-muted">{{ current.description }}</p>
              <p>{{ t.pageReady }}</p>
            } @else {
              <tb-markdown [text]="current.description" />
            }
            <div class="tb-actions">
              <p-button
                [label]="t.discard"
                severity="secondary"
                [text]="true"
                (onClick)="draft.set(null)"
              />
              @if (current.html === null && hasText()) {
                <p-button
                  [label]="t.insert"
                  severity="secondary"
                  (onClick)="apply(current, 'insert')"
                />
              }
              <p-button
                [label]="t.replace"
                severity="success"
                (onClick)="apply(current, 'replace')"
              />
            </div>
          </section>
        }
      </div>
    </p-card>
  `,
  styles: `
    .tb-ai-panel__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
    }

    .tb-ai-panel__sources {
      display: grid;
      gap: var(--tb-space-2);
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
      max-height: 24rem;
      overflow: auto;
      padding: var(--tb-space-3);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-xs);
    }
  `,
})
export class HomeworkAiPanel implements OnInit {
  protected readonly t = T.panel;
  private readonly api = inject(AiApi);
  private readonly snackbar = inject(Snackbar);

  readonly kind = input<HomeworkKind>('WRITTEN');
  /** What the teacher already called the assignment. */
  readonly title = input('');
  /** The assignment has text a draft could go after. */
  readonly hasText = input(false);
  /** Textbook pages and files the draft may be based on. */
  readonly sources = input<readonly SourceOption[]>([]);
  readonly applied = output<AppliedDraft>();

  readonly prompt = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(4_000)],
  });
  readonly promptTitle = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });
  private readonly library = signal<readonly SavedPrompt[]>([]);
  /** Prompts for this kind of homework or for any. */
  protected readonly choices = computed(() =>
    this.library().filter((prompt) => prompt.kind === null || prompt.kind === this.kind()),
  );
  protected readonly quick = computed(() => this.choices().slice(0, QUICK_PROMPTS));
  protected readonly draft = signal<HomeworkDraft | null>(null);
  /** Keys of the chosen sources. */
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly pending = signal(false);
  protected readonly naming = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

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
    this.api
      .homeworkDraft({
        kind: this.kind(),
        prompt,
        title: title === '' ? null : title,
        look: this.kind() === 'INTERACTIVE' ? currentPageLook() : null,
        sources: this.sources()
          .filter((option) => this.chosen().has(option.key))
          .map((option) => option.source),
      })
      .subscribe({
        next: (draft) => {
          this.pending.set(false);
          this.draft.set(draft);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.panel.failed));
        },
      });
  }

  protected apply(draft: HomeworkDraft, mode: 'replace' | 'insert'): void {
    this.applied.emit({ draft, mode });
    this.draft.set(null);
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
    this.api.savePrompt({ title, text: this.prompt.value.trim(), kind: this.kind() }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.naming.set(false);
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
