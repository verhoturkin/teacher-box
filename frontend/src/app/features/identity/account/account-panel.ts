import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
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
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { injectMobile, injectWindowSize } from '@core/layout/mobile';
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
    SelectButton,
    Tooltip,
    TbDialog,
    ChangePasswordForm,
    NotificationsSection,
    NgTemplateOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #profileCard>
      @if (account(); as account) {
        <p-card [header]="t.profile" styleClass="tb-section-card tb-section-card--flow">
          <div class="tb-tiles">
            <div class="tb-tile">
              <tb-avatar [name]="account.displayName" [photo]="account.avatar" size="2.5rem" />
              @if (hasPhoto()) {
                <span class="tb-tile__text">
                  <b>{{ t.photo }}</b>
                  <span>{{ account.avatar === null ? t.noPhoto : t.photoTypes }}</span>
                </span>
                <input
                  #photoFile
                  type="file"
                  class="tb-sr-only"
                  accept="image/jpeg,image/png,image/webp"
                  [attr.aria-label]="t.photoFile"
                  (change)="uploadPhoto(photoFile)"
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
                <p-button
                  [label]="account.avatar === null ? t.uploadPhoto : t.changePhoto"
                  icon="tb-i tb-i-photo_camera"
                  severity="secondary"
                  [loading]="busy.is('photo')"
                  (onClick)="photoFile.click()"
                />
              } @else {
                <span class="tb-tile__text">
                  <b class="tb-account__name">{{ account.displayName }}</b>
                  <span class="tb-account__role">{{ roleLabel() }}</span>
                </span>
              }
            </div>
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
              <label for="account-own-name">{{ t.ownName }}</label>
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
      }
    </ng-template>
    <ng-template #signInCard>
      @if (account(); as account) {
        <p-card [header]="t.signIn" styleClass="tb-section-card tb-section-card--flow">
          @if (medium()) {
            <p-button
              [label]="t.changePasswordLong"
              severity="secondary"
              (onClick)="passwordDialog.set(true)"
            />
          } @else {
            <div class="tb-tiles">
              <div class="tb-tile">
                <span class="tb-tile__icon" aria-hidden="true"
                  ><i class="tb-i tb-i-person"></i
                ></span>
                <span class="tb-tile__text">
                  <b>{{ t.login }}</b>
                  <span>{{ account.login ?? '—' }}</span>
                </span>
              </div>
              <div class="tb-tile">
                <span class="tb-tile__icon" aria-hidden="true"><i class="tb-i tb-i-key"></i></span>
                <span class="tb-tile__text">
                  <b>{{ t.password }}</b>
                </span>
                <p-button
                  [label]="t.changePasswordAction"
                  severity="secondary"
                  (onClick)="passwordDialog.set(true)"
                />
              </div>
            </div>
          }
          <p-button
            [label]="t.signOut"
            icon="tb-i tb-i-logout"
            [text]="true"
            [loading]="busy.is('sign-out')"
            (onClick)="signOut()"
          />
        </p-card>
      }
    </ng-template>
    <ng-template #lookFields>
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
    </ng-template>
    <ng-template #appearanceCard>
      <p-card [header]="t.appearance" styleClass="tb-section-card tb-section-card--flow">
        @if (medium()) {
          <ng-container *ngTemplateOutlet="lookFields" />
        } @else {
          <span id="account-theme-label" class="tb-section-label">{{ t.theme }}</span>
          <p-selectbutton
            [options]="themes"
            optionLabel="label"
            optionValue="value"
            [allowEmpty]="false"
            ariaLabelledBy="account-theme-label"
            [ngModel]="theme.choice()"
            (ngModelChange)="theme.choose($event)"
          >
            <ng-template #item let-option>
              <i
                class="tb-i"
                [class]="option.value === theme.choice() ? 'tb-i-check' : option.icon"
                aria-hidden="true"
              ></i>
              {{ option.label }}
            </ng-template>
          </p-selectbutton>
          <label for="account-language" class="tb-section-label">{{ t.language }}</label>
          <p-select
            inputId="account-language"
            class="tb-account__language"
            optionLabel="label"
            optionValue="value"
            appendTo="body"
            [options]="languages"
            [ngModel]="currentLanguage"
            (onChange)="chooseLanguage($event.value)"
          />
        }
      </p-card>
    </ng-template>
    @if (page() !== 'main' && (mobile() || medium())) {
      <div class="tb-account__sub">
        <p-button
          icon="tb-i tb-i-arrow_back"
          severity="secondary"
          [text]="true"
          [rounded]="true"
          [ariaLabel]="c.back"
          (onClick)="page.set('main')"
        />
        <h2 class="tb-account__subtitle">{{ page() === 'profile' ? t.profile : t.lookRow }}</h2>
      </div>
      <div class="tb-stack">
        @if (page() === 'profile') {
          <ng-container *ngTemplateOutlet="profileCard" />
          @if (mobile()) {
            <ng-container *ngTemplateOutlet="signInCard" />
          }
        } @else {
          <div class="tb-form"><ng-container *ngTemplateOutlet="lookFields" /></div>
        }
      </div>
    } @else if (mobile()) {
      <div class="tb-account tb-account--list">
        @if (account(); as account) {
          <div class="tb-tiles">
            <button type="button" class="tb-tile tb-account__row" (click)="page.set('profile')">
              <tb-avatar [name]="account.displayName" [photo]="account.avatar" size="2.5rem" />
              <span class="tb-tile__text">
                <b>{{ account.displayName }}</b>
                <span>{{ account.login ?? roleLabel() }} · {{ t.profileRow }}</span>
              </span>
              <i class="tb-i tb-i-chevron_right tb-muted" aria-hidden="true"></i>
            </button>
          </div>
        }
        @if (hasPhoto()) {
          <tb-notifications-section [teacher]="isTeacher()" />
        }
        <div class="tb-tiles">
          <button type="button" class="tb-tile tb-account__row" (click)="page.set('look')">
            <span class="tb-tile__icon" aria-hidden="true"><i class="tb-i tb-i-contrast"></i></span>
            <span class="tb-tile__text">
              <b>{{ t.lookRow }}</b>
              <span>{{ lookSummary() }}</span>
            </span>
            <i class="tb-i tb-i-chevron_right tb-muted" aria-hidden="true"></i>
          </button>
          <button type="button" class="tb-tile tb-account__row" (click)="signOut()">
            <span class="tb-tile__icon" aria-hidden="true"><i class="tb-i tb-i-logout"></i></span>
            <span class="tb-tile__text">
              <b>{{ t.signOut }}</b>
            </span>
          </button>
        </div>
      </div>
    } @else if (medium()) {
      <!-- medium (sketch StudentTablet): the profile as a row, «Уведомления», «Оформление» and «Вход» in a pair -->
      <div class="tb-account tb-account--medium">
        @if (account(); as account) {
          <div class="tb-tiles tb-account__wide">
            <div class="tb-tile">
              <tb-avatar [name]="account.displayName" [photo]="account.avatar" size="2.5rem" />
              <span class="tb-tile__text">
                <b>{{ account.displayName }}</b>
                <span>{{
                  isStudent()
                    ? t.seenAs(account.login ?? '—', account.profileName)
                    : (account.login ?? roleLabel()) + ' · ' + t.profileRow
                }}</span>
              </span>
              <p-button [label]="t.edit" severity="secondary" (onClick)="page.set('profile')" />
            </div>
          </div>
        }
        @if (hasPhoto()) {
          <tb-notifications-section [teacher]="isTeacher()" />
        }
        <ng-container *ngTemplateOutlet="appearanceCard" />
        <ng-container *ngTemplateOutlet="signInCard" />
      </div>
    } @else {
      <div class="tb-account">
        <div class="tb-stack">
          <ng-container *ngTemplateOutlet="profileCard" />
          <ng-container *ngTemplateOutlet="signInCard" />
          <ng-container *ngTemplateOutlet="appearanceCard" />
        </div>
        @if (hasPhoto()) {
          <tb-notifications-section [teacher]="isTeacher()" />
        }
      </div>
    }
    <tb-dialog
      kind="form"
      [(visible)]="passwordDialog"
      [headline]="t.changePassword"
      [confirmLabel]="cp.change"
      formId="change-password-form"
      [pending]="passwordForm()?.pending() ?? false"
    >
      <tb-change-password-form
        formId="change-password-form"
        [narrow]="false"
        (changed)="passwordChanged()"
      />
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

    .tb-account__name {
      overflow-wrap: anywhere;
    }

    /* the language select keeps its own width (the sketch) */
    .tb-account__language {
      align-self: flex-start;
      min-width: 12rem;
    }

    /* medium (sketch \`StudentTablet\`): the profile row and «Уведомления» across, then a pair of cards */
    .tb-account--medium {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--tb-space-3);

      > .tb-account__wide,
      ::ng-deep tb-notifications-section > p-card {
        grid-column: 1 / -1;
      }
    }

    /* compact: the list of rows, the profile and the look open as sub-pages */
    .tb-account--list {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--tb-space-3);
    }

    .tb-account__row {
      border: 0;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    .tb-account__sub {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      margin-bottom: var(--tb-space-3);
    }

    .tb-account__subtitle {
      margin: 0;
      font: var(--tb-type-title-l);
    }
  `,
})
export class AccountPanel implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.account;
  protected readonly busy = new Busy();
  protected readonly theme = inject(ThemeMode);
  protected readonly themes: { value: ThemeChoice; label: string; icon: string }[] = [
    { value: 'light', label: T.account.themeLight, icon: 'tb-i-light_mode' },
    { value: 'dark', label: T.account.themeDark, icon: 'tb-i-dark_mode' },
    { value: 'system', label: T.account.themeSystem, icon: 'tb-i-contrast' },
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
  /** Compact: the account is a list; the profile and the look open as sub-pages (sketch `StudentPhone`). */
  protected readonly mobile = injectMobile();
  /** Medium: the profile is a row with «Изменить» that opens it as a sub-page (sketch `StudentTablet`). */
  protected readonly medium = computed(() => this.size() === 'medium');
  private readonly size = injectWindowSize();
  protected readonly page = signal<'main' | 'profile' | 'look'>('main');
  protected readonly lookSummary = computed(
    () =>
      `${this.themes.find((theme) => theme.value === this.theme.choice())?.label ?? ''} · ${this.languages.find((lang) => lang.value === this.currentLanguage)?.label ?? ''}`,
  );
  protected readonly passwordDialog = signal(false);
  protected readonly passwordForm = viewChild(ChangePasswordForm);
  protected readonly cp = T.changePassword;

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
