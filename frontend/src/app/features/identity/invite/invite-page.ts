import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
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
import { ProgressSpinner } from 'primeng/progressspinner';
import { AuthService } from '@core/auth/auth.service';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { PASSWORD_MIN_LENGTH, fieldsMatch } from '@shared/forms/validators';
import { IdentityApi } from '../data-access/identity-api';
import { InviteInfo } from '../data-access/identity.models';

type InviteState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'ready'; readonly invite: InviteInfo };

/** `/invite/:token`: the student sets up credentials (first sign-up) or a new password (reset). */
@Component({
  selector: 'tb-invite-page',
  imports: [ReactiveFormsModule, DatePipe, Button, Card, InputText, Message, Password, ProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="tb-auth-page">
      @switch (state().kind) {
        @case ('loading') {
          <p-progress-spinner ariaLabel="Загрузка приглашения" />
        }
        @case ('invalid') {
          <p-card header="Приглашение недействительно" styleClass="tb-auth-card">
            <p>
              Ссылка устарела или уже была использована. Попросите учителя прислать новое приглашение.
            </p>
          </p-card>
        }
        @case ('ready') {
          @if (invite(); as invite) {
            <p-card [header]="'Здравствуйте, ' + invite.displayName + '!'" styleClass="tb-auth-card">
              <p class="tb-muted">
                @if (isActivation()) {
                  Придумайте логин и пароль для входа в личный кабинет.
                } @else {
                  Задайте новый пароль для логина <strong>{{ invite.login }}</strong>.
                }
                Ссылка действует до {{ invite.expiresAt | date: 'dd.MM.yyyy HH:mm' }}.
              </p>
              <form class="tb-form" [formGroup]="form" (ngSubmit)="submit()">
                @if (isActivation()) {
                  <div class="tb-field">
                    <label for="login">Логин</label>
                    <input pInputText id="login" formControlName="login" autocomplete="username" />
                    <small class="tb-hint">Латинские буквы, цифры, «.», «-», «_» — от 3 до 50 символов</small>
                  </div>
                }
                <div class="tb-field">
                  <label for="password">Пароль</label>
                  <p-password
                    inputId="password"
                    formControlName="password"
                    autocomplete="new-password"
                    [feedback]="false"
                    [toggleMask]="true"
                    [fluid]="true"
                  />
                  <small class="tb-hint">Не короче 8 символов</small>
                </div>
                <div class="tb-field">
                  <label for="confirm">Повторите пароль</label>
                  <p-password
                    inputId="confirm"
                    formControlName="confirm"
                    autocomplete="new-password"
                    [feedback]="false"
                    [toggleMask]="true"
                    [fluid]="true"
                  />
                  @if (form.hasError('fieldsMismatch') && form.controls.confirm.dirty) {
                    <small class="tb-error">Пароли не совпадают</small>
                  }
                </div>
                @if (error(); as message) {
                  <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
                }
                <p-button
                  type="submit"
                  [label]="isActivation() ? 'Создать аккаунт' : 'Сохранить пароль'"
                  [loading]="pending()"
                  [disabled]="form.invalid"
                  [fluid]="true"
                />
              </form>
            </p-card>
          }
        }
      }
    </main>
  `,
})
export class InvitePage implements OnInit {
  private readonly api = inject(IdentityApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Route parameter. */
  readonly token = input.required<string>();

  protected readonly state = signal<InviteState>({ kind: 'loading' });
  protected readonly invite = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.invite : null;
  });
  protected readonly isActivation = computed(() => this.invite()?.purpose === 'ACTIVATION');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      login: ['', [Validators.maxLength(50)]],
      password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.maxLength(128)]],
      confirm: ['', [Validators.required]],
    },
    { validators: [fieldsMatch('password', 'confirm')] },
  );

  ngOnInit(): void {
    this.api.describeInvite(this.token()).subscribe({
      next: (invite) => {
        if (invite.purpose === 'ACTIVATION') {
          this.form.controls.login.addValidators(Validators.required);
          this.form.controls.login.updateValueAndValidity();
        }
        this.state.set({ kind: 'ready', invite });
      },
      error: () => {
        this.state.set({ kind: 'invalid' });
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.pending()) {
      return;
    }
    const { login, password } = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.api.acceptInvite(this.token(), this.isActivation() ? login : null, password).subscribe({
      next: (response) => {
        this.auth.acceptSession(response);
        void this.router.navigateByUrl(this.auth.homeUrl());
      },
      error: (error: unknown) => {
        this.pending.set(false);
        if (problemCode(error) === 'invite.invalid') {
          this.state.set({ kind: 'invalid' });
          return;
        }
        this.error.set(describeError(error, 'Не удалось сохранить. Попробуйте позже'));
      },
    });
  }
}
