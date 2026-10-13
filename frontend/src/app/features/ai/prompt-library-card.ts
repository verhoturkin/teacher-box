import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Textarea } from 'primeng/textarea';
import { describeError } from '@core/http/error-messages';
import { Snackbar } from '@core/snackbar/snackbar';
import { SHARED_T } from '@shared/i18n/texts';
import { dangerConfirmation } from '@shared/ui/confirmation';
import { EmptyState } from '@shared/ui/empty-state';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { AiApi } from './data-access/ai-api';
import { SavedPrompt } from './data-access/ai.models';
import { T } from './i18n/texts';

/** The teacher's prompt library on the AI page: what is saved, renaming, rewording and deleting. */
@Component({
  selector: 'tb-prompt-library-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    ConfirmDialog,
    Dialog,
    InputText,
    Message,
    Textarea,
    EmptyState,
    FieldErrors,
    SubmitFor,
  ],
  providers: [ConfirmationService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card [header]="t.title">
      @if (prompts().length === 0) {
        <tb-empty-state
          [compact]="true"
          icon="pi-bookmark"
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
                  icon="pi pi-pencil"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [ariaLabel]="t.edit(prompt.title)"
                  (onClick)="edit(prompt)"
                />
                <p-button
                  icon="pi pi-trash"
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

    <p-dialog
      [header]="t.editTitle"
      [visible]="editing() !== null"
      (visibleChange)="$event || editing.set(null)"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <form tbFieldErrors id="prompt-form" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-field tb-field--required">
          <label for="prompt-title">{{ t.name }}</label>
          <input pInputText id="prompt-title" formControlName="title" autocomplete="off" />
        </div>
        <div class="tb-field tb-field--required">
          <label for="prompt-text">{{ t.text }}</label>
          <textarea pTextarea id="prompt-text" formControlName="text" rows="6"></textarea>
        </div>
        @if (error(); as message) {
          <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
        }
      </form>
      <ng-template #footer>
        <p-button
          [label]="c.cancel"
          severity="secondary"
          [text]="true"
          (onClick)="editing.set(null)"
        />
        <p-button
          severity="success"
          [label]="t.save"
          [loading]="pending()"
          type="submit"
          tbSubmitFor="prompt-form"
        />
      </ng-template>
    </p-dialog>
    <p-confirmdialog />
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
  protected readonly c = SHARED_T.common;
  protected readonly t = T.library;
  private readonly api = inject(AiApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly snackbar = inject(Snackbar);

  protected readonly prompts = signal<readonly SavedPrompt[]>([]);
  readonly editing = signal<SavedPrompt | null>(null);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    text: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(4_000)],
    }),
  });

  ngOnInit(): void {
    this.api.prompts().subscribe((prompts) => {
      this.prompts.set(prompts);
    });
  }

  edit(prompt: SavedPrompt): void {
    this.error.set(null);
    this.form.reset({ title: prompt.title, text: prompt.text });
    this.editing.set(prompt);
  }

  save(): void {
    const prompt = this.editing();
    if (prompt === null || !revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    if (value.title.trim() === '' || value.text.trim() === '') {
      this.form.markAllAsTouched();
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api
      .updatePrompt(
        prompt.id,
        { title: value.title.trim(), text: value.text.trim() },
        prompt.version,
      )
      .subscribe({
        next: (saved) => {
          this.pending.set(false);
          this.editing.set(null);
          this.prompts.update((prompts) =>
            prompts
              .map((candidate) => (candidate.id === saved.id ? saved : candidate))
              .sort((a, b) => a.title.localeCompare(b.title)),
          );
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.error.set(describeError(error, T.library.failed));
        },
      });
  }

  protected confirmDelete(prompt: SavedPrompt): void {
    this.confirmation.confirm(
      dangerConfirmation({
        header: T.library.deleteHeader,
        message: T.library.deleteMessage(prompt.title),
        acceptLabel: T.library.deleteAccept,
        accept: () => {
          this.api.deletePrompt(prompt.id).subscribe(() => {
            this.prompts.update((prompts) =>
              prompts.filter((candidate) => candidate.id !== prompt.id),
            );
            this.snackbar.success(T.library.deleted);
          });
        },
      }),
    );
  }
}
