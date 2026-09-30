import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import {
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { AuthService } from '@core/auth/auth.service';
import { describeError } from '@core/http/error-messages';
import { PASSWORD_MIN_LENGTH, fieldsMatch } from '@shared/forms/validators';
import { IdentityApi } from '../data-access/identity-api';
import { PasswordToggle } from '@shared/ui/password-toggle';

/**
 * Current password, new password and its confirmation. The new session replaces the current one
 * (the other devices are signed out).
 */
@Component({
  selector: 'tb-change-password-form',
  imports: [ReactiveFormsModule, Button, Message, Password, PasswordToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="tb-form tb-form--narrow"
      [formGroup]="form"
      (ngSubmit)="submit(formDirective)"
      #formDirective="ngForm"
    >
      <div class="tb-field">
        <label for="current">{{ currentLabel() }}</label>
        <p-password
          inputId="current"
          formControlName="current"
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
        <label for="next">Новый пароль</label>
        <p-password
          inputId="next"
          formControlName="next"
          autocomplete="new-password"
          [feedback]="false"
          [toggleMask]="true"
          [fluid]="true"
        >
          <ng-template #showicon><tb-password-toggle /></ng-template>
          <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
        </p-password>
        <small class="tb-hint">Не короче 8 символов</small>
      </div>
      <div class="tb-field">
        <label for="confirm">Повторите новый пароль</label>
        <p-password
          inputId="confirm"
          formControlName="confirm"
          autocomplete="new-password"
          [feedback]="false"
          [toggleMask]="true"
          [fluid]="true"
        >
          <ng-template #showicon><tb-password-toggle /></ng-template>
          <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
        </p-password>
        @if (form.hasError('fieldsMismatch') && form.controls.confirm.dirty) {
          <small class="tb-error">Пароли не совпадают</small>
        }
      </div>
      @if (error(); as message) {
        <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
      }
      <p-button
        type="submit"
        [label]="submitLabel()"
        severity="success"
        [class.tb-tonal]="tonal()"
        [loading]="pending()"
        [disabled]="form.invalid"
      />
      <small class="tb-hint">После смены пароля все остальные устройства выйдут из аккаунта.</small>
    </form>
  `,
})
export class ChangePasswordForm {
  private readonly api = inject(IdentityApi);
  private readonly auth = inject(AuthService);

  readonly currentLabel = input('Текущий пароль');
  readonly submitLabel = input('Сменить пароль');
  /** A section of a page (the account) rather than the main step (the first setup): tonal. */
  readonly tonal = input(false);
  /** The password has been changed. */
  readonly changed = output();

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      current: ['', [Validators.required]],
      next: [
        '',
        [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.maxLength(128)],
      ],
      confirm: ['', [Validators.required]],
    },
    { validators: [fieldsMatch('next', 'confirm')] },
  );

  protected submit(formDirective: FormGroupDirective): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    const { current, next } = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.api.changePassword(current, next).subscribe({
      next: (response) => {
        this.auth.acceptSession(response);
        this.pending.set(false);
        formDirective.resetForm();
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не удалось сменить пароль. Попробуйте позже'));
      },
    });
  }
}
