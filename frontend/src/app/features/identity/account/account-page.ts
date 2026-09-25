import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormGroupDirective, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { AuthService } from '@core/auth/auth.service';
import { describeError } from '@core/http/error-messages';
import { PASSWORD_MIN_LENGTH, fieldsMatch } from '@shared/forms/validators';
import { IdentityApi } from '../data-access/identity-api';
import { Account } from '../data-access/identity.models';

/** Own account of the teacher or a student: profile data and password change. */
@Component({
  selector: 'tb-account-page',
  imports: [ReactiveFormsModule, Button, Card, Message, Password],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="tb-page-title">Мой аккаунт</h1>
    <div class="tb-stack">
      @if (account(); as account) {
        <p-card header="Профиль">
          <dl class="tb-details">
            <dt>Имя</dt>
            <dd>{{ account.displayName }}</dd>
            <dt>Логин</dt>
            <dd>{{ account.login ?? '—' }}</dd>
            <dt>E-mail</dt>
            <dd>{{ account.email ?? '—' }}</dd>
            <dt>Телефон</dt>
            <dd>{{ account.phone ?? '—' }}</dd>
          </dl>
        </p-card>
      }
      <p-card header="Смена пароля">
        <form class="tb-form tb-form--narrow" [formGroup]="form" (ngSubmit)="submit(formDirective)" #formDirective="ngForm">
          <div class="tb-field">
            <label for="current">Текущий пароль</label>
            <p-password inputId="current" formControlName="current" autocomplete="current-password" [feedback]="false" [toggleMask]="true" [fluid]="true" />
          </div>
          <div class="tb-field">
            <label for="next">Новый пароль</label>
            <p-password inputId="next" formControlName="next" autocomplete="new-password" [feedback]="false" [toggleMask]="true" [fluid]="true" />
            <small class="tb-hint">Не короче 8 символов</small>
          </div>
          <div class="tb-field">
            <label for="confirm">Повторите новый пароль</label>
            <p-password inputId="confirm" formControlName="confirm" autocomplete="new-password" [feedback]="false" [toggleMask]="true" [fluid]="true" />
            @if (form.hasError('fieldsMismatch') && form.controls.confirm.dirty) {
              <small class="tb-error">Пароли не совпадают</small>
            }
          </div>
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
          <p-button type="submit" label="Сменить пароль" [loading]="pending()" [disabled]="form.invalid" />
          <small class="tb-hint">После смены пароля все остальные устройства выйдут из аккаунта.</small>
        </form>
      </p-card>
    </div>
  `,
})
export class AccountPage implements OnInit {
  private readonly api = inject(IdentityApi);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);

  protected readonly account = signal<Account | null>(null);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      current: ['', [Validators.required]],
      next: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.maxLength(128)]],
      confirm: ['', [Validators.required]],
    },
    { validators: [fieldsMatch('next', 'confirm')] },
  );

  ngOnInit(): void {
    this.api.account().subscribe((account) => {
      this.account.set(account);
    });
  }

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
        this.messages.add({ severity: 'success', summary: 'Готово', detail: 'Пароль изменён' });
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не удалось сменить пароль. Попробуйте позже'));
      },
    });
  }
}
