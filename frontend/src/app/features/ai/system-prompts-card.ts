import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { SHARED_T } from '@shared/i18n/texts';
import { Confirm } from '@shared/ui/confirm';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { AiApi } from './data-access/ai-api';
import { SystemPrompt } from './data-access/ai.models';
import { T } from './i18n/texts';

/** The longest system prompt, as on the backend (`SystemPrompts.MAX_TEXT`). */
const MAX_TEXT = 10_000;

/**
 * System prompts of the assistant on the AI page (ADR-0043): the rules of the homework and review
 * drafts, rewritten by the teacher or the standard ones.
 */
@Component({
  selector: 'tb-system-prompts-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    Dialog,
    Message,
    Tag,
    Textarea,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="system-prompts" [header]="t.title">
      <p class="tb-hint">{{ t.hint }}</p>
      <ul class="tb-list tb-list--no-phone-lead">
        @for (prompt of prompts(); track prompt.feature) {
          <li>
            <div class="tb-list__text">
              <span class="tb-list__title">
                {{ t.features[prompt.feature] }}
                @if (prompt.custom) {
                  <p-tag [value]="t.custom" severity="info" />
                }
              </span>
              <span class="tb-system-prompt-text">{{ prompt.text }}</span>
            </div>
            <div class="tb-list__trail tb-list__trail--icons">
              <p-button
                icon="tb-i tb-i-edit"
                [text]="true"
                [rounded]="true"
                severity="secondary"
                [ariaLabel]="t.edit(t.features[prompt.feature])"
                (onClick)="edit(prompt)"
              />
            </div>
          </li>
        }
      </ul>
    </p-card>

    <p-dialog
      [header]="header()"
      [visible]="editing() !== null"
      (visibleChange)="$event || editing.set(null)"
      [modal]="true"
      styleClass="tb-dialog tb-dialog--wide"
      [draggable]="false"
    >
      <form
        tbFieldErrors
        id="system-prompt-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="save()"
      >
        <div class="tb-field tb-field--required">
          <label for="system-prompt-text">{{ t.text }}</label>
          <textarea
            pTextarea
            id="system-prompt-text"
            formControlName="text"
            rows="14"
            [autoResize]="true"
          ></textarea>
          <small class="tb-hint">{{ t.textHint }}</small>
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        @if (editing()?.custom) {
          <p-button
            [label]="t.reset"
            severity="secondary"
            [text]="true"
            [loading]="resetting()"
            (onClick)="confirmReset()"
          />
        }
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="editing.set(null)"
        />
        <p-button
          [label]="t.save"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="system-prompt-form"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: `
    .tb-list__title {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-system-prompt-text {
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
  `,
})
export class SystemPromptsCard implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.systemPrompts;
  private readonly api = inject(AiApi);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);

  protected readonly prompts = signal<readonly SystemPrompt[]>([]);
  readonly editing = signal<SystemPrompt | null>(null);
  protected readonly header = computed(() => {
    const prompt = this.editing();
    return prompt === null ? '' : T.systemPrompts.features[prompt.feature];
  });
  protected readonly pending = signal(false);
  protected readonly resetting = signal(false);
  protected readonly error = signal<string | null>(null);
  readonly form = new FormGroup({
    text: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_TEXT)],
    }),
  });

  ngOnInit(): void {
    this.api.systemPrompts().subscribe((prompts) => {
      this.prompts.set(prompts);
    });
  }

  edit(prompt: SystemPrompt): void {
    this.error.set(null);
    this.form.reset({ text: prompt.text });
    this.editing.set(prompt);
  }

  save(): void {
    const prompt = this.editing();
    if (prompt === null || !revealErrors(this.form) || this.pending()) {
      return;
    }
    const text = this.form.controls.text.value.trim();
    if (text === '') {
      this.form.markAllAsTouched();
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api.updateSystemPrompt(prompt.feature, text, prompt.version).subscribe({
      next: (saved) => {
        this.pending.set(false);
        this.editing.set(null);
        this.replace(saved);
        this.snackbar.success(T.systemPrompts.saved);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, T.systemPrompts.failed));
      },
    });
  }

  protected async confirmReset(): Promise<void> {
    const prompt = this.editing();
    if (prompt === null) {
      return;
    }
    if (
      await this.confirm.danger({
        header: T.systemPrompts.resetHeader,
        message: T.systemPrompts.resetMessage,
        acceptLabel: T.systemPrompts.resetAccept,
      })
    ) {
      this.reset(prompt);
    }
  }

  private reset(prompt: SystemPrompt): void {
    this.resetting.set(true);
    this.api.resetSystemPrompt(prompt.feature).subscribe({
      next: (standard) => {
        this.resetting.set(false);
        this.editing.set(null);
        this.replace(standard);
        this.snackbar.success(T.systemPrompts.resetDone);
      },
      error: () => {
        this.resetting.set(false);
      },
    });
  }

  private replace(prompt: SystemPrompt): void {
    this.prompts.update((prompts) =>
      prompts.map((candidate) => (candidate.feature === prompt.feature ? prompt : candidate)),
    );
  }
}
