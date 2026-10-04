import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { AuthService } from '@core/auth/auth.service';
import { IdentityApi } from '../data-access/identity-api';
import { Account } from '../data-access/identity.models';
import { ChangePasswordForm } from './change-password-form';
import { PageHeader } from '@shared/ui/page-header';
import { Snackbar } from '@core/snackbar/snackbar';

/** Own account of the teacher or a student: profile data and password change. */
@Component({
  selector: 'tb-account-page',
  imports: [ReactiveFormsModule, Button, Card, InputText, ChangePasswordForm, PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tb-page-header title="Мой аккаунт" />
    <div class="tb-stack tb-stack--narrow">
      @if (account(); as account) {
        <p-card header="Профиль">
          <div class="tb-stack">
            @if (isTeacher()) {
              <form class="tb-form" [formGroup]="nameForm" (ngSubmit)="rename()">
                <div class="tb-field">
                  <label for="account-name">Имя</label>
                  <input
                    pInputText
                    id="account-name"
                    formControlName="name"
                    aria-label="Имя"
                    maxlength="100"
                  />
                  <small class="tb-hint"
                    >Так вас видят ученики в портале и в сообщениях бота.</small
                  >
                </div>
                <div class="tb-form-actions">
                  <p-button
                    class="tb-tonal"
                    type="submit"
                    label="Сохранить"
                    severity="success"
                    [disabled]="
                      nameForm.invalid ||
                      nameForm.controls.name.value.trim() === account.displayName
                    "
                    [loading]="renaming()"
                  />
                </div>
              </form>
            }
            <dl class="tb-details">
              @if (!isTeacher()) {
                <dt>Имя</dt>
                <dd>{{ account.displayName }}</dd>
              }
              <dt>Логин</dt>
              <dd>{{ account.login ?? '—' }}</dd>
              <dt>E-mail</dt>
              <dd>{{ account.email ?? '—' }}</dd>
              <dt>Телефон</dt>
              <dd>{{ account.phone ?? '—' }}</dd>
            </dl>
          </div>
        </p-card>
      }
      <p-card header="Смена пароля">
        <tb-change-password-form [tonal]="true" (changed)="passwordChanged()" />
      </p-card>
    </div>
  `,
})
export class AccountPage implements OnInit {
  private readonly api = inject(IdentityApi);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(Snackbar);

  protected readonly account = signal<Account | null>(null);
  protected readonly isTeacher = computed(() => this.account()?.role === 'TEACHER');
  protected readonly renaming = signal(false);

  readonly nameForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)],
    }),
  });

  ngOnInit(): void {
    this.api.account().subscribe((account) => {
      this.show(account);
    });
  }

  rename(): void {
    if (this.nameForm.invalid || this.renaming()) {
      return;
    }
    this.renaming.set(true);
    this.api.renameTeacher(this.nameForm.controls.name.value.trim()).subscribe({
      next: (account) => {
        this.renaming.set(false);
        this.show(account);
        this.auth.renamed(account.displayName);
        this.snackbar.success('Имя сохранено');
      },
      error: () => {
        this.renaming.set(false);
      },
    });
  }

  protected passwordChanged(): void {
    this.snackbar.success('Пароль изменён');
  }

  private show(account: Account): void {
    this.account.set(account);
    this.nameForm.setValue({ name: account.displayName });
  }
}
