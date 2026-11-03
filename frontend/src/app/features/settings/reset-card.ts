import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { HelpButton } from '@features/help/parts';
import { Portal } from '@core/portal/portal';
import { SettingsApi } from './data-access/settings-api';
import { BackupInfo } from './data-access/settings.models';
import { BackupsApi } from './backups/backups-api';
import { RestoreDialog } from './backups/restore-dialog';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { FieldErrors } from '@shared/ui/field-errors';
import { Snackbar } from '@core/snackbar/snackbar';
import { T } from './i18n/texts';

/** The word the teacher types to confirm the reset. */
export const RESET_WORD = T.reset.word;

function isWord(value: string): boolean {
  return value.trim().toUpperCase() === RESET_WORD;
}

/** Teacher: deleting all data of the portal after a backup (ADR-0014). */
@Component({
  selector: 'tb-reset-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    TbDialog,
    HelpButton,
    InputText,
    Message,
    Password,
    PasswordToggle,
    FieldErrors,
    RestoreDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="reset" styleClass="tb-section-card">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text tb-negative"
            >{{ t.title }} <tb-help-button topic="teacher/backups"
          /></span>
        </div>
      </ng-template>
      <p class="tb-muted">{{ t.about }}</p>
      <ul class="tb-list tb-list--no-phone-lead">
        <li>
          <div class="tb-list__text">
            <span class="tb-list__title">{{ t.restoreTitle }}</span>
            <span class="tb-list__supporting">{{ t.restoreHint }}</span>
          </div>
          <div class="tb-list__trail">
            <p-button
              [label]="t.restore"
              severity="danger"
              [text]="true"
              [loading]="finding()"
              (onClick)="openRestore()"
            />
          </div>
        </li>
        <li>
          <div class="tb-list__text">
            <span class="tb-list__title">{{ t.clearTitle }}</span>
            <span class="tb-list__supporting">{{ t.clearHint }}</span>
          </div>
          <div class="tb-list__trail">
            <p-button
              [label]="t.open"
              icon="tb-i tb-i-delete"
              severity="danger"
              [text]="true"
              (onClick)="open()"
            />
          </div>
        </li>
      </ul>
    </p-card>
    <tb-restore-dialog
      [(visible)]="restoring"
      [(backup)]="newest"
      [choices]="copies()"
      area="teacher"
    />
    <tb-dialog
      kind="form"
      [(visible)]="visible"
      [headline]="t.header"
      [confirmLabel]="t.reset"
      confirmSeverity="danger"
      formId="reset-form"
      [pending]="submit.pending()"
      [error]="submit.error()"
      [dirty]="submit.dirty()"
    >
      <p-message severity="error" icon="tb-i tb-i-warning" styleClass="tb-form-message">
        {{ t.warning }} {{ t.stays }}
      </p-message>
      <form
        tbFieldErrors
        id="reset-form"
        class="tb-form"
        [formGroup]="form"
        (ngSubmit)="submit.run()"
      >
        <div class="tb-field">
          <label for="reset-password">{{ t.password }}</label>
          <p-password
            inputId="reset-password"
            formControlName="password"
            autocomplete="current-password"
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
          <label for="reset-word">{{ t.typeWord(word) }}</label>
          <input pInputText id="reset-word" formControlName="word" autocomplete="off" />
        </div>
      </form>
    </tb-dialog>
  `,
})
export class ResetCard {
  protected readonly t = T.reset;
  private readonly api = inject(SettingsApi);
  private readonly backups = inject(BackupsApi);
  private readonly portal = inject(Portal);
  private readonly router = inject(Router);
  private readonly snackbar = inject(Snackbar);

  protected readonly word = RESET_WORD;
  protected readonly visible = signal(false);
  protected readonly restoring = signal(false);
  protected readonly finding = signal(false);
  protected readonly newest = signal<BackupInfo | null>(null);
  protected readonly copies = signal<BackupInfo[]>([]);

  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    word: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        (control: AbstractControl<string>) => (isWord(control.value) ? null : { pattern: true }),
      ],
    }),
  });

  open(): void {
    this.visible.set(true);
  }

  /** The restore dialog for the newest copy; another one is chosen in the list of copies. */
  protected openRestore(): void {
    this.finding.set(true);
    this.backups.list('teacher').subscribe({
      next: (backups) => {
        this.finding.set(false);
        const newest = backups.reduce<BackupInfo | null>(
          (latest, backup) =>
            latest === null || backup.createdAt > latest.createdAt ? backup : latest,
          null,
        );
        if (newest === null) {
          this.snackbar.notice(T.backups.empty);
          return;
        }
        this.copies.set([...backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        this.newest.set(newest);
        this.restoring.set(true);
      },
      error: () => {
        this.finding.set(false);
      },
    });
  }

  protected readonly submit = dialogSubmit({
    visible: this.visible,
    form: this.form,
    failed: T.reset.failed,
    request: (value) => this.api.reset(value.password),
    done: (result) => {
      this.snackbar.success(T.reset.done(result.backup));
      for (const hint of result.hints) {
        // a step left to do after the reset stays until it is read
        this.snackbar.notice(hint);
      }
      this.portal.setSetupCompleted(false);
      void this.portal.load().then(() => this.router.navigateByUrl('/teacher/setup'));
    },
  });
}
