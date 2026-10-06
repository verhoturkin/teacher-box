import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { from, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { AuthService } from '@core/auth/auth.service';
import { SquarePhoto } from '@shared/files/square-photo';
import { Avatar } from '@shared/ui/avatar';
import { Busy } from '@shared/ui/busy';
import { IdentityApi } from '../data-access/identity-api';
import { Account } from '../data-access/identity.models';
import { ChangePasswordForm } from './change-password-form';
import { PageHeader } from '@shared/ui/page-header';
import { Snackbar } from '@core/snackbar/snackbar';

/**
 * Own account of the teacher or a student: profile data and password change. The teacher renames
 * themselves for the students; a student chooses a photo and the name the portal calls them (the
 * teacher keeps seeing the name they gave).
 */
@Component({
  selector: 'tb-account-page',
  imports: [
    ReactiveFormsModule,
    Avatar,
    Button,
    Card,
    InputText,
    Tooltip,
    ChangePasswordForm,
    PageHeader,
  ],
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
                  <input pInputText id="account-name" formControlName="name" maxlength="100" />
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
            @if (isStudent()) {
              <input
                #photoFile
                type="file"
                class="tb-sr-only"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Файл фото"
                (change)="uploadPhoto(photoFile)"
              />
              <div class="tb-photo-row">
                <tb-avatar [name]="account.displayName" [photo]="account.avatar" size="3.5rem" />
                <p-button
                  [label]="account.avatar === null ? 'Загрузить фото' : 'Сменить фото'"
                  icon="pi pi-camera"
                  severity="secondary"
                  [loading]="busy.is('photo')"
                  (onClick)="photoFile.click()"
                />
                @if (account.avatar !== null) {
                  <p-button
                    icon="pi pi-trash"
                    severity="danger"
                    [text]="true"
                    [rounded]="true"
                    pTooltip="Убрать фото"
                    ariaLabel="Убрать фото"
                    [loading]="busy.is('remove-photo')"
                    (onClick)="removePhoto()"
                  />
                }
              </div>
              <form class="tb-form" [formGroup]="ownNameForm" (ngSubmit)="renameSelf()">
                <div class="tb-field">
                  <label for="account-own-name">Имя</label>
                  <input pInputText id="account-own-name" formControlName="name" maxlength="100" />
                  <small class="tb-hint"
                    >Так портал обращается к вам. Учитель видит вас как «{{ account.profileName }}».
                    Оставьте поле пустым, чтобы вернуть это имя.</small
                  >
                </div>
                <div class="tb-form-actions">
                  <p-button
                    class="tb-tonal"
                    type="submit"
                    label="Сохранить"
                    severity="success"
                    [disabled]="ownNameUnchanged(account)"
                    [loading]="renaming()"
                  />
                </div>
              </form>
            }
            <dl class="tb-details">
              @if (!isTeacher() && !isStudent()) {
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
  styles: `
    /* the photo, «Сменить фото» and the bin keep one line on a 360 px phone */
    .tb-photo-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }
  `,
})
export class AccountPage implements OnInit {
  protected readonly busy = new Busy();
  private readonly api = inject(IdentityApi);
  private readonly auth = inject(AuthService);
  private readonly squarePhoto = inject(SquarePhoto);
  private readonly snackbar = inject(Snackbar);

  protected readonly account = signal<Account | null>(null);
  protected readonly isTeacher = computed(() => this.account()?.role === 'TEACHER');
  protected readonly isStudent = computed(() => this.account()?.role === 'STUDENT');
  protected readonly renaming = signal(false);

  readonly nameForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)],
    }),
  });

  /** A student's own name; empty — the name the teacher gave. */
  readonly ownNameForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
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
        this.changed(account);
        this.snackbar.success('Имя сохранено');
      },
      error: () => {
        this.renaming.set(false);
      },
    });
  }

  renameSelf(): void {
    if (this.renaming()) {
      return;
    }
    this.renaming.set(true);
    this.api.renameSelf(this.ownNameToSave()).subscribe({
      next: (account) => {
        this.renaming.set(false);
        this.changed(account);
        this.snackbar.success('Имя сохранено');
      },
      error: () => {
        this.renaming.set(false);
      },
    });
  }

  /** The chosen picture is cut to a square and scaled down here, then sent. */
  uploadPhoto(input: HTMLInputElement): void {
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (file === null) {
      return;
    }
    this.busy
      .guard(
        'photo',
        from(this.squarePhoto.from(file)).pipe(switchMap((photo) => this.api.changeAvatar(photo))),
      )
      .subscribe({
        next: (account) => {
          this.changed(account);
          this.snackbar.success('Фото сохранено');
        },
        error: (error: unknown) => {
          // a failed request already shows its error; a picture the browser cannot open does not
          if (!(error instanceof HttpErrorResponse)) {
            this.snackbar.error('Не удалось открыть картинку. Выберите фото в JPEG, PNG или WebP.');
          }
        },
      });
  }

  removePhoto(): void {
    this.busy.guard('remove-photo', this.api.removeAvatar()).subscribe((account) => {
      this.changed(account);
    });
  }

  /** Empty or the teacher's name: the student goes back to the name the teacher gave. */
  private ownNameToSave(): string {
    const name = this.ownNameForm.controls.name.value.trim();
    return name === this.account()?.profileName ? '' : name;
  }

  protected ownNameUnchanged(account: Account): boolean {
    const name = this.ownNameToSave();
    return (name === '' ? account.profileName : name) === account.displayName;
  }

  protected passwordChanged(): void {
    this.snackbar.success('Пароль изменён');
  }

  private changed(account: Account): void {
    this.show(account);
    this.auth.profileChanged(account);
  }

  private show(account: Account): void {
    this.account.set(account);
    this.nameForm.setValue({ name: account.displayName });
    this.ownNameForm.setValue({ name: account.displayName });
  }
}
