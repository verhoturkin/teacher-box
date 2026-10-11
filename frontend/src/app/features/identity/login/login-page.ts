import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
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
import { Portal } from '@core/portal/portal';
import { PortalLogo } from '@core/portal/portal-logo';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { T } from '../i18n/texts';
import { LanguagePicker } from '@core/i18n/language-picker';

@Component({
  selector: 'tb-login-page',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    InputText,
    Message,
    Password,
    PortalLogo,
    PasswordToggle,
    LanguagePicker,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="tb-auth-page">
      <tb-portal-logo size="3rem" />
      <p-card
        [header]="t.title(portalName())"
        styleClass="tb-auth-card"
        [pt]="{ title: { role: 'heading', 'aria-level': '1' } }"
      >
        @if (sessionExpired()) {
          <p-message severity="info" styleClass="tb-form-message">{{ t.expired }}</p-message>
        }
        <form class="tb-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="tb-field">
            <label for="login">{{ t.login }}</label>
            <input pInputText id="login" formControlName="login" autocomplete="username" />
          </div>
          <div class="tb-field">
            <label for="password">{{ t.password }}</label>
            <p-password
              inputId="password"
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
          @if (error(); as message) {
            <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
          }
          <!-- Never disabled: Enter must always submit (also right after password manager autofill). -->
          <p-button
            type="submit"
            [label]="t.submit"
            icon="pi pi-sign-in"
            [loading]="pending()"
            [fluid]="true"
          />
        </form>
      </p-card>
      <tb-language-picker />
    </main>
  `,
})
export class LoginPage {
  protected readonly t = T.login;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef);

  protected readonly portalName = inject(Portal).name;

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
    if (this.pending()) {
      return;
    }
    if (this.form.invalid) {
      this.error.set(T.login.required);
      this.focus(this.form.controls.login.invalid ? 'login' : 'password');
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
        this.error.set(describeError(error, T.login.failed));
        // after a wrong password the focus is in the password, not lost on the page (ADR-0024)
        this.focus('password');
      },
    });
  }

  private focus(id: string): void {
    const host: unknown = this.host.nativeElement;
    if (host instanceof HTMLElement) {
      host.querySelector<HTMLInputElement>(`#${id}`)?.focus();
    }
  }
}
