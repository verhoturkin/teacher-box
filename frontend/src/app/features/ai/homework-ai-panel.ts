import {
  ChangeDetectionStrategy,
  Component,
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
import { Button, ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Listbox } from 'primeng/listbox';
import { Message } from 'primeng/message';
import { Popover } from 'primeng/popover';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { MarkdownView } from '@shared/ui/markdown-view';
import { AiApi } from './data-access/ai-api';
import { HomeworkDraft, SavedPrompt, SourceOption } from './data-access/ai.models';
import { T } from './i18n/texts';

/** A draft the teacher took: it replaces the assignment's content or goes after its text. */
export interface AppliedDraft {
  readonly draft: HomeworkDraft;
  readonly mode: 'replace' | 'insert';
}

/**
 * The AI assistant over the assignment text: a request in the teacher's words (typed, or taken from the prompt
 * library in the «Промты» menu), the sources it reads, and the draft it brings — between the request and the text.
 * Nothing reaches the assignment until the teacher says so.
 */
@Component({
  selector: 'tb-homework-ai-panel',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    Button,
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Checkbox,
    InputText,
    Listbox,
    Message,
    Popover,
    Textarea,
    MarkdownView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tb-ai-panel" [attr.aria-label]="t.title">
      <div class="tb-ai-panel__request" [class.tb-ai-panel__request--folded]="folded()">
        <i class="pi pi-sparkles tb-ai-panel__mark" aria-hidden="true"></i>
        <textarea
          pTextarea
          id="ai-prompt"
          class="tb-ai-panel__prompt"
          [formControl]="prompt"
          rows="2"
          [attr.aria-label]="t.prompt"
          [placeholder]="t.placeholder"
          (focus)="focused.set(true)"
          (blur)="focused.set(false)"
        ></textarea>
      </div>
      <div class="tb-ai-panel__actions">
        <p-button
          [label]="t.prompts"
          icon="pi pi-bookmark"
          severity="secondary"
          size="small"
          ariaHasPopup="dialog"
          (onClick)="prompts.toggle($event)"
        />
        @if (sources().length > 0) {
          <p-button
            [label]="chosen().size > 0 ? t.sourcesCount(chosen().size) : t.sources"
            icon="pi pi-book"
            severity="secondary"
            size="small"
            ariaHasPopup="dialog"
            (onClick)="sourcePicker.toggle($event)"
          />
        }
        <p-button
          class="tb-ai-panel__generate"
          [label]="draft() === null ? t.generate : t.again"
          [icon]="draft() === null ? 'pi pi-sparkles' : 'pi pi-refresh'"
          size="small"
          [loading]="pending()"
          (onClick)="generate()"
        />
      </div>

      <p-popover #prompts [ariaLabel]="t.prompts" (onHide)="naming.set(false)">
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
              <p-listbox
                [options]="library()"
                optionLabel="title"
                [filter]="true"
                filterBy="title,text"
                [filterPlaceHolder]="t.search"
                [ariaFilterLabel]="t.search"
                [ariaLabel]="t.prompts"
                [emptyFilterMessage]="t.notFound"
                scrollHeight="16rem"
                styleClass="tb-ai-panel__library"
                (onChange)="use($event.value)"
              >
                <ng-template #item let-option>
                  <div class="tb-ai-panel__option">
                    <span>{{ option.title }}</span>
                    <small>{{ option.text }}</small>
                  </div>
                </ng-template>
              </p-listbox>
            } @else {
              <p class="tb-hint">{{ t.noPrompts }}</p>
            }
            <div class="tb-ai-panel__menu-actions">
              <p-button
                [label]="t.savePrompt"
                icon="pi pi-bookmark"
                severity="secondary"
                [text]="true"
                (onClick)="startNaming()"
              />
              <a pButton routerLink="/teacher/ai" severity="secondary" [text]="true">
                <i pButtonIcon aria-hidden="true" class="pi pi-cog"></i>
                <span pButtonLabel>{{ t.manage }}</span>
              </a>
            </div>
          }
        </div>
      </p-popover>

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
      @if (draft(); as current) {
        <section class="tb-ai-panel__draft" [attr.aria-label]="t.draft">
          <header class="tb-ai-panel__draft-header">
            <span class="tb-ai-panel__badge">{{ t.draft }}</span>
            <h3 class="tb-ai-panel__draft-title">{{ current.title }}</h3>
            <div class="tb-actions">
              <p-button
                [label]="t.discard"
                severity="secondary"
                [text]="true"
                size="small"
                (onClick)="draft.set(null)"
              />
              @if (hasText()) {
                <p-button
                  [label]="t.insert"
                  severity="secondary"
                  size="small"
                  (onClick)="apply(current, 'insert')"
                />
              }
              <p-button
                [label]="t.replace"
                icon="pi pi-check"
                size="small"
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
    </section>
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

    .tb-ai-panel__library {
      border: 0;
      background: transparent;
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
  `,
})
export class HomeworkAiPanel implements OnInit {
  protected readonly t = T.panel;
  private readonly api = inject(AiApi);
  private readonly snackbar = inject(Snackbar);
  private readonly menu = viewChild.required<Popover>('prompts');

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
  protected readonly library = signal<SavedPrompt[]>([]);
  protected readonly draft = signal<HomeworkDraft | null>(null);
  /** Keys of the chosen sources. */
  protected readonly chosen = signal<ReadonlySet<string>>(new Set());
  protected readonly pending = signal(false);
  protected readonly naming = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly focused = signal(false);
  /** The request folds to a line while the teacher looks at a draft. */
  protected readonly folded = computed(() => this.draft() !== null && !this.focused());

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
      this.menu().hide();
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
        prompt,
        title: title === '' ? null : title,
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
    this.api.savePrompt({ title, text: this.prompt.value.trim() }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.naming.set(false);
        this.menu().hide();
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
