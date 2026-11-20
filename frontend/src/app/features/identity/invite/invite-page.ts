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
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { LoadingIndicator } from '@shared/ui/loading-indicator';
import { AuthService } from '@core/auth/auth.service';
import { describeError } from '@core/http/error-messages';
import { problemCode } from '@core/http/problem-detail';
import { Portal } from '@core/portal/portal';
import { PortalLogo } from '@core/portal/portal-logo';
import { PASSWORD_MIN_LENGTH, fieldsMatch } from '@shared/forms/validators';
import { IdentityApi } from '../data-access/identity-api';
import { InviteInfo } from '../data-access/identity.models';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { FieldErrors, revealErrors, showAtField } from '@shared/ui/field-errors';
import { T } from '../i18n/texts';
import { LanguagePicker } from '@core/i18n/language-picker';
import { locale } from '@core/i18n/language';
import { Snackbar } from '@core/snackbar/snackbar';

const CHILDREN = new Intl.ListFormat(locale(), { type: 'conjunction' });

type InviteState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'ready'; readonly invite: InviteInfo };

/**
 * `/invite/:token`: the student or a parent sets up credentials (first sign-up) or a new password (reset); a
 * parent's invitation names their children (ADR-0069).
 */
@Component({
  selector: 'tb-invite-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    Button,
    Card,
    InputText,
    Message,
    Password,
    LoadingIndicator,
    PortalLogo,
    PasswordToggle,
    FieldErrors,
    LanguagePicker,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="tb-auth-page">
      <tb-portal-logo size="3rem" />
      <p class="tb-muted">{{ portalName() }}</p>
      @switch (state().kind) {
        @case ('loading') {
          <tb-loading-indicator [ariaLabel]="t.loading" />
        }
        @case ('invalid') {
          <p-card
            [header]="t.invalidTitle"
            styleClass="tb-auth-card"
            [pt]="{ title: { role: 'heading', 'aria-level': '1' } }"
          >
            <p>{{ t.invalidText }}</p>
            @if (auth.isAuthenticated()) {
              <p-button [label]="t.toCabinet" [routerLink]="auth.homeUrl()" [fluid]="true" />
            } @else {
              <p-button [label]="t.signIn" routerLink="/login" [fluid]="true" />
            }
          </p-card>
        }
        @case ('ready') {
          @if (invite(); as invite) {
            <p-card
              [header]="t.hello(invite.displayName)"
              styleClass="tb-auth-card"
              [pt]="{ title: { role: 'heading', 'aria-level': '1' } }"
            >
              <p class="tb-muted">
                @if (isActivation()) {
                  {{ t.activation(portalName()) }}
                } @else {
                  {{ t.resetBefore }} <strong>{{ invite.login }}</strong
                  >{{ t.resetAfter }}
                }
                {{ t.validUntil((invite.expiresAt | date: 'dd.MM.yyyy HH:mm') ?? '') }}
              </p>
              @if (children(); as children) {
                <div class="tb-invite-guardian">
                  <i class="tb-i tb-i-family_restroom" aria-hidden="true"></i>
                  <p>
                    <strong>{{ t.guardian(invite.children.length, children) }}</strong>
                    <span class="tb-muted">{{ t.guardianHint }}</span>
                  </p>
                </div>
              }
              @if (isTeacher()) {
                <p-message severity="warn" styleClass="tb-form-message">{{
                  isGuardian() ? t.teacherBannerGuardian : t.teacherBanner
                }}</p-message>
              }
              <form tbFieldErrors class="tb-form" [formGroup]="form" (ngSubmit)="submit()">
                @if (isActivation()) {
                  <div class="tb-field">
                    <label for="login">{{ t.login }}</label>
                    <input pInputText id="login" formControlName="login" autocomplete="username" />
                    <small class="tb-hint">{{ t.loginHint }}</small>
                  </div>
                }
                <div class="tb-field">
                  <label for="password">{{ t.password }}</label>
                  <p-password
                    inputId="password"
                    formControlName="password"
                    autocomplete="new-password"
                    [feedback]="false"
                    [toggleMask]="true"
                    [fluid]="true"
                  >
                    <ng-template #showicon><tb-password-toggle /></ng-template>
                    <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
                  </p-password>
                  <small class="tb-hint">{{ t.passwordHint }}</small>
                </div>
                <div class="tb-field">
                  <label for="confirm">{{ t.confirm }}</label>
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
                    <small class="tb-error">{{ t.mismatch }}</small>
                  }
                </div>
                @if (error(); as message) {
                  <p-message severity="error" styleClass="tb-form-message">{{ message }}</p-message>
                }
                <p-button
                  type="submit"
                  [label]="isActivation() ? t.createAccount : t.savePassword"
                  [loading]="pending()"
                  [disabled]="isTeacher()"
                  [fluid]="true"
                />
              </form>
            </p-card>
          }
        }
      }
      <tb-language-picker />
    </main>
  `,
  styles: `
    /* a parent's invitation: who the parent is, in a secondary container (M3: secondary for what needs no
       immediate action; ours: the block, its corner and spacing) */
    .tb-invite-guardian {
      display: flex;
      align-items: flex-start;
      gap: var(--tb-space-3);
      margin-block-end: var(--tb-space-4);
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-radius-m);
      background: var(--p-md-secondary-container);
      color: var(--p-md-on-secondary-container);

      .tb-i {
        font-size: 1.5rem;
      }

      p {
        display: flex;
        flex-direction: column;
        gap: var(--tb-space-1);
        margin: 0;
        font: var(--tb-type-body-m);
      }

      strong {
        font: var(--tb-type-title-s);
      }

      .tb-muted {
        color: inherit;
      }
    }
  `,
})
export class InvitePage implements OnInit {
  protected readonly t = T.invite;
  private readonly api = inject(IdentityApi);
  protected readonly auth = inject(AuthService);
  private readonly snackbar = inject(Snackbar);
  private readonly router = inject(Router);

  protected readonly portalName = inject(Portal).name;

  /** Route parameter. */
  readonly token = input.required<string>();

  protected readonly state = signal<InviteState>({ kind: 'loading' });
  protected readonly invite = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.invite : null;
  });
  protected readonly isActivation = computed(() => this.invite()?.purpose === 'ACTIVATION');
  protected readonly isGuardian = computed(() => this.invite()?.role === 'GUARDIAN');
  /** A parent's children joined for the greeting («Петя и Маша»); `null` for a student. */
  protected readonly children = computed(() => {
    const invite = this.invite();
    return invite?.role === 'GUARDIAN' && invite.children.length > 0
      ? CHILDREN.format(invite.children)
      : null;
  });
  protected readonly isTeacher = computed(() => this.auth.role() === 'TEACHER');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      login: ['', [Validators.pattern(/^[A-Za-z0-9._-]{3,50}$/)]],
      password: [
        '',
        [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH), Validators.maxLength(128)],
      ],
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
        if (this.isTeacher()) {
          this.form.disable();
        }
        this.state.set({ kind: 'ready', invite });
      },
      error: () => {
        this.state.set({ kind: 'invalid' });
      },
    });
  }

  protected submit(): void {
    if (this.isTeacher() || !revealErrors(this.form) || this.pending()) {
      return;
    }
    const { login, password } = this.form.getRawValue();
    this.pending.set(true);
    this.error.set(null);
    this.api.acceptInvite(this.token(), this.isActivation() ? login : null, password).subscribe({
      next: (response) => {
        this.auth.acceptSession(response);
        this.snackbar.success(this.isActivation() ? this.t.created : this.t.passwordSaved);
        void this.router.navigateByUrl(this.auth.homeUrl());
      },
      error: (error: unknown) => {
        this.pending.set(false);
        if (problemCode(error) === 'invite.invalid') {
          this.state.set({ kind: 'invalid' });
          return;
        }
        const { login, password } = this.form.controls;
        const fields = {
          'login.taken': login,
          'login.invalid': login,
          'login.required': login,
          'password.weak': password,
        };
        if (showAtField(error, fields)) {
          return;
        }
        this.error.set(describeError(error, T.invite.failed));
      },
    });
  }
}
