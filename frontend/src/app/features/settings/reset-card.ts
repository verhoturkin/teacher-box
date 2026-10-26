import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Password } from 'primeng/password';
import { HelpButton } from '@features/help/parts';
import { Portal } from '@core/portal/portal';
import { SettingsApi } from './data-access/settings-api';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from './i18n/texts';

/** The word the teacher types to confirm the reset. */
export const RESET_WORD = T.reset.word;

function isWord(value: string): boolean {
  return value.trim().toUpperCase() === RESET_WORD;
}

/** Teacher: deleting all data of the portal after a backup (ADR-0014). */
@Component({
  selector: 'tb-reset-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    TbDialog,
    HelpButton,
    InputText,
    Password,
    PasswordToggle,
    FieldErrors,
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
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.header"
      [confirmLabel]="t.reset"
      confirmSeverity="danger"
      formId="reset-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      <p>{{ t.warning }}</p>
      <form
        tbFieldErrors
        id="reset-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
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
      </form>
    </tb-dialog>
  `,
})
export class ResetCard {
  protected readonly t = T.reset;
  private readonly api = inject(SettingsApi);
  private readonly portal = inject(Portal);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);

  protected readonly word = RESET_WORD;
  protected readonly visible = signal(false);

  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    word: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        (control: AbstractControl<string>) => (isWord(control.value) ? null : { pattern: true }),
      ],
    }),
  });

  open(): void {
    this.visible.set(true);
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.reset.failed,
    request: (value) => this.api.reset(value.password),
    done: (result) => {
      this.snackbar.success(T.reset.done(result.backup));
      for (const hint of result.hints) {
        // a step left to do after the reset stays until it is read
        this.snackbar.notice(hint);
      }
      this.portal.setSetupCompleted(false);
      void this.portal.load().then(() => this.router.navigateByUrl('/teacher/setup'));
    },
  });
}
