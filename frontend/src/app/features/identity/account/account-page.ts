import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { AuthService } from '@core/auth/auth.service';
import { IdentityApi } from '../data-access/identity-api';
import { Account } from '../data-access/identity.models';
import { ChangePasswordForm } from './change-password-form';
import { PageHeader } from '@shared/ui/page-header';

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
          <dl class="tb-details">
            <dt>Имя</dt>
            <dd>
              @if (isTeacher()) {
                <form class="tb-copy-row" [formGroup]="nameForm" (ngSubmit)="rename()">
                  <input
                    pInputText
                    formControlName="name"
                    aria-label="Имя"
                    maxlength="100"
                    class="tb-grow"
                  />
                  <p-button
                    type="submit"
                    label="Сохранить"
                    severity="secondary"
                    [disabled]="
                      nameForm.invalid ||
                      nameForm.controls.name.value.trim() === account.displayName
                    "
                    [loading]="renaming()"
                  />
                </form>
                <small class="tb-hint">Так вас видят ученики в портале и в сообщениях бота.</small>
              } @else {
                {{ account.displayName }}
              }
            </dd>
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
        <tb-change-password-form [tonal]="true" (changed)="passwordChanged()" />
      </p-card>
    </div>
  `,
})
export class AccountPage implements OnInit {
  private readonly api = inject(IdentityApi);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);

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
        this.messages.add({ severity: 'success', summary: 'Готово', detail: 'Имя сохранено' });
      },
      error: () => {
        this.renaming.set(false);
      },
    });
  }

  protected passwordChanged(): void {
    this.messages.add({ severity: 'success', summary: 'Готово', detail: 'Пароль изменён' });
  }

  private show(account: Account): void {
    this.account.set(account);
    this.nameForm.setValue({ name: account.displayName });
  }
}
