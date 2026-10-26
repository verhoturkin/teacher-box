import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { Snackbar } from '@core/snackbar/snackbar';
import { Confirm } from '@shared/ui/confirm';
import { EmptyState } from '@shared/ui/empty-state';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { AiApi } from './data-access/ai-api';
import { SavedPrompt } from './data-access/ai.models';
import { T } from './i18n/texts';

/** Whitespace only is as empty as nothing (the texts are trimmed on save). */
function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

/** The teacher's prompt library on the AI page: what is saved, renaming, rewording and deleting. */
@Component({
  selector: 'tb-prompt-library-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    TbDialog,
    InputText,
    Textarea,
    EmptyState,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="prompt-library" [header]="t.title">
      @if (prompts().length === 0) {
        <tb-empty-state
          [compact]="true"
          icon="tb-i-bookmark"
          [title]="t.empty"
          [hint]="t.emptyHint"
        />
      } @else {
        <ul class="tb-list tb-list--no-phone-lead">
          @for (prompt of prompts(); track prompt.id) {
            <li>
              <div class="tb-list__text">
                <span class="tb-list__title">{{ prompt.title }}</span>
                <span class="tb-prompt-text">{{ prompt.text }}</span>
              </div>
              <div class="tb-list__trail tb-list__trail--icons">
                <p-button
                  icon="tb-i tb-i-edit"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [ariaLabel]="t.edit(prompt.title)"
                  (onClick)="edit(prompt)"
                />
                <p-button
                  icon="tb-i tb-i-delete"
                  [text]="true"
                  [rounded]="true"
                  severity="danger"
                  [ariaLabel]="t.delete(prompt.title)"
                  (onClick)="confirmDelete(prompt)"
                />
              </div>
            </li>
          }
        </ul>
      }
    </p-card>

    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.editTitle"
      [confirmLabel]="t.save"
      formId="prompt-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      <form
        tbFieldErrors
        id="prompt-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
        <div class="tb-field tb-field--required">
          <label for="prompt-title">{{ t.name }}</label>
          <input pInputText id="prompt-title" formControlName="title" autocomplete="off" />
        </div>
        <div class="tb-field tb-field--required">
          <label for="prompt-text">{{ t.text }}</label>
          <textarea pTextarea id="prompt-text" formControlName="text" rows="6"></textarea>
        </div>
      </form>
    </tb-dialog>
  `,
  styles: `
    .tb-prompt-text {
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      white-space: pre-line;
    }
  `,
})
export class PromptLibraryCard implements OnInit {
  protected readonly t = T.library;
  private readonly api = inject(AiApi);
  private readonly confirm = inject(Confirm);
  private readonly snackbar = inject(Snackbar);

  protected readonly prompts = signal<readonly SavedPrompt[]>([]);
  readonly editing = signal<SavedPrompt | null>(null);
  readonly visible = signal(false);
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.maxLength(100)],
    }),
    text: new FormControl('', {
      nonNullable: true,
      validators: [notBlank, Validators.maxLength(4_000)],
    }),
  });

  ngOnInit(): void {
    this.api.prompts().subscribe((prompts) => {
      this.prompts.set(prompts);
    });
  }

  edit(prompt: SavedPrompt): void {
    this.editing.set(prompt);
    this.visible.set(true);
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.library.failed,
    reset: () => {
      const prompt = this.editing();
      this.form.reset({ title: prompt?.title ?? '', text: prompt?.text ?? '' });
    },
    request: (value) => {
      const prompt = this.editing();
      return this.api.updatePrompt(
        prompt?.id ?? '',
        { title: value.title.trim(), text: value.text.trim() },
        prompt?.version ?? 0,
      );
    },
    done: (saved) => {
      this.prompts.update((prompts) =>
        prompts
          .map((candidate) => (candidate.id === saved.id ? saved : candidate))
          .sort((a, b) => a.title.localeCompare(b.title)),
      );
    },
  });

  protected async confirmDelete(prompt: SavedPrompt): Promise<void> {
    if (
      await this.confirm.danger({
        header: T.library.deleteHeader,
        message: T.library.deleteMessage(prompt.title),
        acceptLabel: T.library.deleteAccept,
      })
    ) {
      this.api.deletePrompt(prompt.id).subscribe(() => {
        this.prompts.update((prompts) => prompts.filter((candidate) => candidate.id !== prompt.id));
        this.snackbar.success(T.library.deleted);
      });
    }
  }
}
