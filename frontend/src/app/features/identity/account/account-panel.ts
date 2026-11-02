import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { from, switchMap } from 'rxjs';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { LANGUAGES, Language, chooseLanguage, language } from '@core/i18n/language';
import { ThemeChoice, ThemeMode } from '@core/theme/theme-mode';
import { AuthService } from '@core/auth/auth.service';
import { checkFiles } from '@shared/files/check-files';
import { SquarePhoto } from '@shared/files/square-photo';
import { Avatar } from '@shared/ui/avatar';
import { Busy } from '@shared/ui/busy';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { IdentityApi } from '../data-access/identity-api';
import { Account } from '../data-access/identity.models';
import { Role } from '@core/auth/auth.models';
import { ChangePasswordForm } from './change-password-form';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import { NotificationsSection } from '@features/notifications/parts';

const ROLE_LABELS: Readonly<Record<Role, string>> = T.roles;

/** Pictures the browser can cut into a square; the size is not limited — the result is scaled down. */
const AVATAR_POLICY = { extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] };

/**
 * Own account of the teacher, a student or the administrator in sections: «Профиль» (photo, name),
 * «Вход» (login, password, «Выйти»), «Оформление» (theme, language) in one column and «Уведомления»
 * of the teacher and a student next to it. Fields save on change. The teacher renames themselves for
 * the students, a student chooses the name the portal calls them (the teacher keeps seeing the name
 * they gave). The content of «Мой аккаунт»: the page of a student and the administrator, the
 * category of the teacher's settings.
 */
@Component({
  selector: 'tb-account-panel',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    Avatar,
    Button,
    Card,
    InputText,
    Select,
    Tooltip,
    TbDialog,
    ChangePasswordForm,
    NotificationsSection,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tb-account">
      <div class="tb-stack">
        @if (account(); as account) {
          <p-card [header]="t.profile">
            <div class="tb-account__head">
              <tb-avatar [name]="account.displayName" [photo]="account.avatar" size="4rem" />
              <div class="tb-account__who">
                <h2 class="tb-account__name">{{ account.displayName }}</h2>
                <span class="tb-account__role">{{ roleLabel() }}</span>
              </div>
              @if (hasPhoto()) {
                <input
                  #photoFile
                  type="file"
                  class="tb-sr-only"
                  accept="image/jpeg,image/png,image/webp"
                  [attr.aria-label]="t.photoFile"
                  (change)="uploadPhoto(photoFile)"
                />
                <div class="tb-account__photo">
                  <p-button
                    [label]="account.avatar === null ? t.uploadPhoto : t.changePhoto"
                    icon="tb-i tb-i-photo_camera"
                    severity="secondary"
                    [loading]="busy.is('photo')"
                    (onClick)="photoFile.click()"
                  />
                  @if (account.avatar !== null) {
                    <p-button
                      icon="tb-i tb-i-delete"
                      severity="danger"
                      [text]="true"
                      [rounded]="true"
                      [pTooltip]="t.removePhoto"
                      [ariaLabel]="t.removePhoto"
                      [loading]="busy.is('remove-photo')"
                      (onClick)="removePhoto()"
                    />
                  }
                </div>
              }
            </div>
            @if (isTeacher()) {
              <div class="tb-field">
                <label for="account-name">{{ t.name }}</label>
                <input
                  pInputText
                  id="account-name"
                  [formControl]="nameForm.controls.name"
                  maxlength="100"
                  (change)="rename()"
                />
                <small class="tb-hint">{{ t.teacherNameHint }}</small>
              </div>
            }
            @if (isStudent()) {
              <div class="tb-field">
                <label for="account-own-name">{{ t.name }}</label>
                <input
                  pInputText
                  id="account-own-name"
                  [formControl]="ownNameForm.controls.name"
                  maxlength="100"
                  (change)="renameSelf()"
                />
                <small class="tb-hint">{{ t.ownNameHint(account.profileName) }}</small>
              </div>
            }
          </p-card>
          <p-card [header]="t.signIn">
            <dl class="tb-account__facts">
              <div>
                <dt>{{ t.login }}</dt>
                <dd>{{ account.login ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ t.password }}</dt>
                <dd>
                  <p-button
                    [label]="t.changePasswordAction"
                    severity="secondary"
                    (onClick)="passwordDialog.set(true)"
                  />
                </dd>
              </div>
            </dl>
            <p-button
              [label]="t.signOut"
              icon="tb-i tb-i-logout"
              [text]="true"
              [loading]="busy.is('sign-out')"
              (onClick)="signOut()"
            />
          </p-card>
        }
        <p-card [header]="t.appearance">
          <div class="tb-form">
            <div class="tb-field">
              <label for="account-theme">{{ t.theme }}</label>
              <p-select
                inputId="account-theme"
                optionLabel="label"
                optionValue="value"
                appendTo="body"
                [options]="themes"
                [ngModel]="theme.choice()"
                (onChange)="theme.choose($event.value)"
              />
            </div>
            <div class="tb-field">
              <label for="account-language">{{ t.language }}</label>
              <p-select
                inputId="account-language"
                optionLabel="label"
                optionValue="value"
                appendTo="body"
                [options]="languages"
                [ngModel]="currentLanguage"
                (onChange)="chooseLanguage($event.value)"
              />
            </div>
          </div>
        </p-card>
      </div>
      @if (hasPhoto()) {
        <tb-notifications-section [teacher]="isTeacher()" />
      }
    </div>
    <tb-dialog
      kind="form"
      [(visible)]="passwordDialog"
      [headline]="t.changePassword"
      [cancelLabel]="c.close"
    >
      <tb-change-password-form [tonal]="true" [narrow]="false" (changed)="passwordChanged()" />
    </tb-dialog>
  `,
  styles: `
    /* the account and «Уведомления» side by side when both fit (sketch \`Main\`); one column below */
    .tb-account {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 22.5rem), 1fr));
      gap: var(--tb-space-4);
      align-items: start;
    }

    /* the photo, the name and the role in a row; the fields of the section follow */
    .tb-account__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-4) var(--tb-space-5);
      margin-bottom: var(--tb-space-4);
    }

    .tb-account__who {
      display: flex;
      flex: 1 1 12rem;
      flex-direction: column;
      gap: var(--tb-space-1);
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .tb-account__name {
      margin: 0;
      font: var(--tb-type-headline-m-emphasized);
    }

    .tb-account__role {
      font: var(--tb-type-title-m);
    }

    /* «Сменить фото» and the bin keep one line on a 360 px phone */
    .tb-account__photo {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
    }

    /* login and password: label over value, in a row that wraps */
    .tb-account__facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
      gap: var(--tb-space-4);
      margin: 0 0 var(--tb-space-4);

      dt {
        font: var(--tb-type-label-l);
        margin-bottom: var(--tb-space-1);
      }

      dd {
        margin: 0;
        font: var(--tb-type-body-l);
        overflow-wrap: anywhere;
      }
    }

    @media (width < 37.5em) {
      .tb-account__name {
        font: var(--tb-type-headline-s-emphasized);
      }
    }
  `,
})
export class AccountPanel implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.account;
  protected readonly busy = new Busy();
  protected readonly theme = inject(ThemeMode);
  protected readonly themes: { value: ThemeChoice; label: string }[] = [
    { value: 'light', label: T.account.themeLight },
    { value: 'dark', label: T.account.themeDark },
    { value: 'system', label: T.account.themeSystem },
  ];
  /** Switching the language reloads the page (ADR-0035). */
  protected readonly languages: { value: Language; label: string }[] = LANGUAGES.map(
    ({ code, name }) => ({ value: code, label: name }),
  );
  protected readonly currentLanguage = language();
  protected readonly chooseLanguage = chooseLanguage;
  private readonly api = inject(IdentityApi);
  private readonly auth = inject(AuthService);
  private readonly squarePhoto = inject(SquarePhoto);
  private readonly snackbar = inject(Snackbar);

  protected readonly account = signal<Account | null>(null);
  protected readonly isTeacher = computed(() => this.account()?.role === 'TEACHER');
  protected readonly isStudent = computed(() => this.account()?.role === 'STUDENT');
  /** A student and the teacher choose a photo and notifications; the administrator has neither. */
  protected readonly hasPhoto = computed(() => this.isStudent() || this.isTeacher());
  protected readonly roleLabel = computed(() => ROLE_LABELS[this.account()?.role ?? 'STUDENT']);
  protected readonly renaming = signal(false);
  protected readonly passwordDialog = signal(false);

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

  /** Saves on change; an empty or unchanged name goes back to the saved one. */
  rename(): void {
    const account = this.account();
    if (account === null || this.renaming()) {
      return;
    }
    const name = this.nameForm.controls.name.value.trim();
    if (this.nameForm.invalid || name === account.displayName) {
      this.nameForm.setValue({ name: account.displayName });
      return;
    }
    this.renaming.set(true);
    this.api.renameTeacher(name).subscribe({
      next: (saved) => {
        this.renaming.set(false);
        this.changed(saved);
        this.snackbar.success(T.account.nameSaved);
      },
      error: () => {
        this.renaming.set(false);
      },
    });
  }

  renameSelf(): void {
    const account = this.account();
    if (account === null || this.renaming() || this.ownNameUnchanged(account)) {
      return;
    }
    this.renaming.set(true);
    this.api.renameSelf(this.ownNameToSave()).subscribe({
      next: (saved) => {
        this.renaming.set(false);
        this.changed(saved);
        this.snackbar.success(T.account.nameSaved);
      },
      error: () => {
        this.renaming.set(false);
      },
    });
  }

  /** The chosen picture is cut to a square and scaled down here, then sent. */
  async uploadPhoto(input: HTMLInputElement): Promise<void> {
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (file === null) {
      return;
    }
    const { rejected } = await checkFiles([file], AVATAR_POLICY);
    if (rejected[0] !== undefined) {
      this.snackbar.error(rejected[0].message);
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
          this.snackbar.success(T.account.photoSaved);
        },
        error: (error: unknown) => {
          // a failed request already shows its error; a picture the browser cannot open does not
          if (!(error instanceof HttpErrorResponse)) {
            this.snackbar.error(T.account.photoUnreadable);
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

  protected signOut(): void {
    this.busy.guard('sign-out', this.auth.logout()).subscribe();
  }

  protected passwordChanged(): void {
    this.passwordDialog.set(false);
    this.snackbar.success(T.account.passwordChanged);
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
