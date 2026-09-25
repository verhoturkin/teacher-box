import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { AuthService } from '@core/auth/auth.service';
import { safeReturnUrl } from '@core/auth/return-url';
import { describeError } from '@core/http/error-messages';

@Component({
  selector: 'tb-login-page',
  imports: [ReactiveFormsModule, Button, Card, InputText, Message, Password],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="tb-auth-page">
      <p-card header="Вход в Teacher Box" styleClass="tb-auth-card">
        @if (sessionExpired()) {
          <p-message severity="info" styleClass="tb-form-message">Сессия истекла. Войдите снова.</p-message>
        }
        <form class="tb-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="tb-field">
            <label for="login">Логин</label>
            <input pInputText id="login" formControlName="login" autocomplete="username" />
          </div>
          <div class="tb-field">
            <label for="password">Пароль</label>
            <p-password
              inputId="password"
              formControlName="password"
              autocomplete="current-password"
              [feedback]="false"
              [toggleMask]="true"
              [fluid]="true"
            />
          </div>
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
          <p-button
            type="submit"
            label="Войти"
            icon="pi pi-sign-in"
            [loading]="pending()"
            [disabled]="form.invalid"
            [fluid]="true"
          />
        </form>
      </p-card>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Query parameters (bound by the router). */
  readonly returnUrl = input<string>();
  readonly expired = input<string>();

  protected readonly sessionExpired = computed(() => this.expired() !== undefined);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    login: ['', [Validators.required, Validators.maxLength(64)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    const { login, password } = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.auth.login(login, password).subscribe({
      next: () => {
        void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? this.auth.homeUrl());
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.error.set(describeError(error, 'Не удалось войти. Попробуйте позже'));
      },
    });
  }
}
