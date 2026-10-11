import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { AuthService } from '@core/auth/auth.service';
import { describeError } from '@core/http/error-messages';
import { RESTART_POLL_MS, RESTART_WAIT_MS } from '@shared/restart/restart-wait';
import { BackupInfo, RestoreStatus } from '../data-access/settings.models';
import { BackupsApi, BackupsArea } from './backups-api';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { SubmitFor } from '@shared/ui/submit-for';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

type Stage = 'confirm' | 'restarting' | 'manual' | 'done' | 'failed' | 'silent';

/**
 * Restoring a backup: the warning, the password, and then waiting while the portal restarts and
 * applies it (ADR-0014).
 */
@Component({
  selector: 'tb-restore-dialog',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    Button,
    Dialog,
    Message,
    Password,
    PasswordToggle,
    FieldErrors,
    SubmitFor,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-dialog
      [header]="t.title"
      [(visible)]="visible"
      [modal]="true"
      [closable]="stage() !== 'restarting'"
      styleClass="tb-dialog tb-dialog--short"
      [draggable]="false"
      (onHide)="reset()"
    >
      @if (backup(); as backup) {
        @switch (stage()) {
          @case ('confirm') {
            <p>
              {{ t.replaceBefore }}
              <strong>{{ backup.createdAt | date: 'dd.MM.yyyy HH:mm' }}</strong
              >{{ t.replaceAfter }}
            </p>
            <p class="tb-muted">{{ t.beforeRestore }}</p>
            <form
              tbFieldErrors
              id="restore-form"
              class="tb-form"
              [formGroup]="form"
              (ngSubmit)="restore()"
            >
              <div class="tb-field">
                <label for="restore-password">{{ t.password }}</label>
                <p-password
                  inputId="restore-password"
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
            </form>
          }
          @case ('restarting') {
            <p><i class="pi pi-spin pi-spinner" aria-hidden="true"></i> {{ t.restarting }}</p>
            <p class="tb-muted">{{ t.keepOpen }}</p>
          }
          @case ('manual') {
            <p-message severity="info" styleClass="tb-form-message">
              {{ t.manualBefore }} <code>docker compose restart</code> {{ t.manualAfter }}
            </p-message>
          }
          @case ('done') {
            <p-message severity="success" styleClass="tb-form-message">
              {{ t.done }}
            </p-message>
          }
          @case ('failed') {
            <p-message severity="error" styleClass="tb-form-message">
              {{ t.failed }}
              @if (failure(); as reason) {
                {{ t.reason(reason) }}
              }
            </p-message>
          }
          @case ('silent') {
            <p-message severity="warn" styleClass="tb-form-message">
              {{ t.silent }}
            </p-message>
          }
        }
      }
      <ng-template #footer>
        @switch (stage()) {
          @case ('confirm') {
            <p-button
              [label]="c.cancel"
              severity="secondary"
              [text]="true"
              (onClick)="visible.set(false)"
            />
            <p-button
              type="submit"
              tbSubmitFor="restore-form"
              [label]="t.restore"
              severity="danger"
              [loading]="pending()"
            />
          }
          @case ('done') {
            <p-button [label]="t.signInAgain" icon="pi pi-sign-in" (onClick)="signInAgain()" />
          }
        }
      </ng-template>
    </p-dialog>
  `,
})
export class RestoreDialog {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.restore;
  private readonly api = inject(BackupsApi);
  private readonly auth = inject(AuthService);
  private readonly pollMs = inject(RESTART_POLL_MS);

  readonly visible = model(false);
  readonly backup = input<BackupInfo | null>(null);
  readonly area = input<BackupsArea>('teacher');

  protected readonly stage = signal<Stage>('confirm');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly failure = signal<string | null>(null);

  readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  /** When the running portal started: a new value means it has restarted. */
  private startedAt: string | null = null;
  private deadline = 0;
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopPolling();
    });
  }

  /** After closing: the next backup starts from the warning with an empty password. */
  reset(): void {
    this.stage.set('confirm');
    this.error.set(null);
    this.failure.set(null);
    this.form.reset();
  }

  restore(): void {
    const backup = this.backup();
    if (backup === null || !revealErrors(this.form) || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.error.set(null);
    this.api.restoreStatus(this.area()).subscribe({
      next: (status) => {
        this.startedAt = status.startedAt;
        this.request(backup.name);
      },
      error: (error: unknown) => {
        this.fail(error);
      },
    });
  }

  /** One question to the portal while it restarts. */
  checkRestart(): void {
    if (Date.now() > this.deadline) {
      this.stopPolling();
      this.stage.set('silent');
      return;
    }
    this.api.restoreStatus(this.area()).subscribe({
      next: (status) => {
        if (status.startedAt !== this.startedAt) {
          this.finished(status);
        }
      },
      error: () => {
        // The portal is still starting.
      },
    });
  }

  signInAgain(): void {
    this.auth.logout().subscribe();
  }

  private request(name: string): void {
    this.api.restore(this.area(), name, this.form.controls.password.value).subscribe({
      next: (requested) => {
        this.pending.set(false);
        if (!requested.restarting) {
          this.stage.set('manual');
          return;
        }
        this.stage.set('restarting');
        this.deadline = Date.now() + RESTART_WAIT_MS;
        this.poll = setInterval(() => {
          this.checkRestart();
        }, this.pollMs);
      },
      error: (error: unknown) => {
        this.fail(error);
      },
    });
  }

  private finished(status: RestoreStatus): void {
    this.stopPolling();
    const last = status.lastRestore;
    if (last !== null && last.restored && last.archive === this.backup()?.name) {
      this.stage.set('done');
    } else {
      this.failure.set(last?.error ?? null);
      this.stage.set('failed');
    }
  }

  private fail(error: unknown): void {
    this.pending.set(false);
    this.error.set(describeError(error, T.restore.error));
  }

  private stopPolling(): void {
    if (this.poll !== null) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }
}
