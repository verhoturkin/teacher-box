import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { describeError } from '@core/http/error-messages';
import { HelpButton } from '@features/help/parts';
import { Portal } from '@core/portal/portal';
import { SettingsApi } from './data-access/settings-api';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from './i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

/** The word the teacher types to confirm the reset. */
export const RESET_WORD = T.reset.word;

/** Teacher: deleting all data of the portal after a backup (ADR-0014). */
@Component({
  selector: 'tb-reset-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    Dialog,
    HelpButton,
    InputText,
    Message,
    Password,
    PasswordToggle,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="reset">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >{{ t.title }} <tb-help-button topic="teacher/backups"
          /></span>
        </div>
      </ng-template>
      <p>{{ t.about }}</p>
      <p class="tb-muted">{{ t.stays }}</p>
      <p-button [label]="t.open" icon="tb-i tb-i-delete" severity="secondary" (onClick)="open()" />
    </p-card>
    <p-dialog
      [header]="t.header"
      [(visible)]="visible"
      [modal]="true"
      styleClass="tb-dialog"
      [draggable]="false"
    >
      <p>{{ t.warning }}</p>
      <form tbFieldErrors id="reset-form" class="tb-form" [formGroup]="form" (ngSubmit)="reset()">
        <div class="tb-field">
          <label for="reset-password">{{ t.password }}</label>
          <p-password
            inputId="reset-password"
            formControlName="password"
            autocomplete="current-password"
            [feedback]="false"
            [toggleMask]="true"
            [fluid]="true"
          >
            <ng-template #showicon><tb-password-toggle /></ng-template>
            <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
          </p-password>
        </div>
        <div class="tb-field">
          <label for="reset-word">{{ t.typeWord(word) }}</label>
          <input pInputText id="reset-word" formControlName="word" autocomplete="off" />
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
          (onClick)="visible.set(false)"
        />
        <p-button
          type="submit"
          tbSubmitFor="reset-form"
          [label]="t.reset"
          severity="danger"
          [disabled]="!confirmed()"
          [loading]="pending()"
        />
      </ng-template>
    </p-dialog>
  `,
})
export class ResetCard {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.reset;
  private readonly api = inject(SettingsApi);
  private readonly portal = inject(Portal);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);

  protected readonly word = RESET_WORD;
  protected readonly visible = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    word: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  open(): void {
    this.form.reset();
    this.error.set(null);
    this.visible.set(true);
  }

  protected confirmed(): boolean {
    return this.form.controls.word.value.trim().toUpperCase() === RESET_WORD;
  }

  reset(): void {
    if (!revealErrors(this.form) || !this.confirmed() || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api.reset(this.form.controls.password.value).subscribe({
      next: (result) => {
        this.pending.set(false);
        this.visible.set(false);
        this.snackbar.success(T.reset.done(result.backup));
        for (const hint of result.hints) {
          // a step left to do after the reset stays until it is read
          this.snackbar.notice(hint);
        }
        this.portal.setSetupCompleted(false);
        void this.portal.load().then(() => this.router.navigateByUrl('/teacher/setup'));
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, T.reset.failed));
      },
    });
  }
}
