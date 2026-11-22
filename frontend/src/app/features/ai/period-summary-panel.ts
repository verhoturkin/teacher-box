import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { MarkdownView } from '@shared/ui/markdown-view';
import { AiApi } from './data-access/ai-api';
import { T } from './i18n/texts';
import { AiModelPick } from './ai-model-pick';
import { AiModelChoice } from './model-choice';
import { AiContextChips, StudentContext } from './student-context';

/**
 * «Составить с ИИ» of the page «Итоги за период» (roadmap 11 «AI», ADR-0072): the teacher's wishes, the student's
 * AI tags and the model; the server reads the lessons, plans and homework of the period itself. The answer is an
 * editable draft with «Копировать»; it is printed as rendered Markdown and is neither saved nor sent.
 */
@Component({
  selector: 'tb-period-summary-panel',
  imports: [
    AiContextChips,
    AiModelPick,
    Button,
    MarkdownView,
    Message,
    ReactiveFormsModule,
    Textarea,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tb-period-ai" [attr.aria-label]="t.title">
      <div class="tb-period-ai__ask tb-no-print">
        <div class="tb-field">
          <label for="period-ai-prompt">{{ t.wishes }}</label>
          <textarea
            pTextarea
            id="period-ai-prompt"
            class="tb-period-ai__prompt"
            [formControl]="prompt"
            rows="2"
            [placeholder]="t.placeholder"
          ></textarea>
        </div>
        <tb-ai-context-chips [state]="context" [students]="students()" />
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
        <div class="tb-period-ai__foot">
          <small class="tb-hint tb-period-ai__grow">{{ t.readsFacts }}</small>
          <span class="tb-period-ai__run">
            <tb-ai-model-pick />
            <p-button
              [label]="pending() ? t.generating : drafted() ? t.again : t.generate"
              [icon]="drafted() ? 'tb-i tb-i-refresh' : 'tb-i tb-i-auto_awesome'"
              [loading]="pending()"
              [disabled]="!ready()"
              (onClick)="generate()"
            />
          </span>
        </div>
      </div>

      @if (drafted()) {
        <section class="tb-period-ai__draft" [attr.aria-label]="t.draft">
          <div class="tb-period-ai__draft-head tb-no-print">
            <label class="tb-period-ai__badge" for="period-ai-draft">{{ t.draft }}</label>
            <p-button
              [label]="t.copy"
              icon="tb-i tb-i-content_copy"
              severity="secondary"
              (onClick)="copy()"
            />
          </div>
          <textarea
            pTextarea
            id="period-ai-draft"
            class="tb-period-ai__text tb-no-print"
            [formControl]="summary"
            rows="12"
          ></textarea>
          <small class="tb-hint tb-no-print">{{ t.draftHint }}</small>
          <tb-markdown class="tb-print-only" [text]="summary.value" />
        </section>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .tb-period-ai,
    .tb-period-ai__ask,
    .tb-period-ai__draft {
      display: grid;
      gap: var(--tb-space-4);
      align-content: start;
    }

    .tb-period-ai__prompt,
    .tb-period-ai__text {
      width: 100%;
      resize: vertical;
      field-sizing: content;
    }

    .tb-period-ai__prompt {
      max-height: 12rem;
    }

    .tb-period-ai__text {
      min-height: 12rem;
      font: var(--tb-type-body-l);
      letter-spacing: var(--tb-tracking-body-l);
    }

    .tb-period-ai__foot,
    .tb-period-ai__draft-head {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-2);
      align-items: center;
    }

    .tb-period-ai__draft-head {
      justify-content: space-between;
    }

    .tb-period-ai__grow {
      flex: 1;
    }

    .tb-period-ai__run {
      display: flex;
      gap: var(--tb-space-2);
      align-items: center;
      margin-inline-start: auto;
    }

    /* the draft marker as in the other AI panes: a tertiary container (M3: tertiary marks small accents) */
    .tb-period-ai__badge {
      padding: var(--tb-space-1) var(--tb-space-2);
      border-radius: var(--tb-shape-sm);
      background: var(--p-md-tertiary-container);
      color: var(--p-md-on-tertiary-container);
      font: var(--tb-type-label-m);
      letter-spacing: var(--tb-tracking-label-m);
    }
  `,
})
export class PeriodSummaryPanel {
  protected readonly t = T.periodPanel;
  private readonly api = inject(AiApi);
  private readonly model = inject(AiModelChoice);
  private readonly clipboard = inject(Clipboard);
  private readonly snackbar = inject(Snackbar);

  readonly studentId = input.required<string>();
  /** ISO dates: the first and the last day of the period. */
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  /** The period is valid: the request can go. */
  readonly ready = input(true);

  readonly prompt = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(4_000)],
  });
  /** The draft the teacher edits; nothing keeps it after the page is left. */
  readonly summary = new FormControl('', { nonNullable: true });
  protected readonly drafted = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly context = new StudentContext();
  /** The chips read the AI tags of the student. */
  protected readonly students = computed(() => [this.studentId()]);

  generate(): void {
    if (!this.ready() || this.prompt.invalid || this.pending()) {
      this.prompt.markAsTouched();
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    const wishes = this.prompt.value.trim();
    const brief = {
      studentId: this.studentId(),
      from: this.from(),
      to: this.to(),
      ...(wishes === '' ? {} : { prompt: wishes }),
      context: this.context.context(this.students()),
    };
    this.model
      .send((modelId) => this.api.periodSummary({ ...brief, modelId }))
      .subscribe({
        next: (draft) => {
          this.pending.set(false);
          this.summary.setValue(draft.summary);
          this.drafted.set(true);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, this.t.failed));
        },
      });
  }

  protected copy(): void {
    if (this.clipboard.copy(this.summary.value)) {
      this.snackbar.success(this.t.copied);
    } else {
      this.snackbar.error(this.t.copyFailed);
    }
  }
}
