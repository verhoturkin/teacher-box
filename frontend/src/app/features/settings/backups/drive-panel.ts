import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { HelpButton } from '@features/help/parts';
import { Portal } from '@core/portal/portal';
import { Snackbar } from '@core/snackbar/snackbar';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { formatFileSize } from '@shared/files/file-size';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { EmptyState } from '@shared/ui/empty-state';
import { Busy } from '@shared/ui/busy';
import { SHARED_T } from '@shared/i18n/texts';
import { CloudBackup } from '../data-access/settings.models';
import { BackupsApi } from './backups-api';
import { DriveStore } from './drive-store';
import { T } from '../i18n/texts';

type Severity = 'success' | 'info' | 'warn' | 'error';

/** Messages for the result Google's redirect brings back (`?drive=...`). */
export const DRIVE_RESULTS: Readonly<Record<string, { severity: Severity; text: string }>> = {
  connected: { severity: 'success', text: T.drive.connectedResult },
  denied: { severity: 'warn', text: T.drive.denied },
  expired: { severity: 'warn', text: T.drive.expired },
  failed: { severity: 'error', text: T.drive.failed },
};

/**
 * The teacher's Google Drive for copies of the backups (ADR-0037): setup of an OAuth client,
 * connecting with Google's consent page, how the uploads go, the copies there and bringing one back
 * to the server.
 */
@Component({
  selector: 'tb-drive-panel',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    Button,
    Card,
    EmptyState,
    HelpButton,
    InputText,
    Message,
    Password,
    Tag,
    Tooltip,
    PasswordToggle,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="drive">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >{{ t.title }} <tb-help-button topic="teacher/backups"
          /></span>
        </div>
      </ng-template>
      @if (result(); as result) {
        <p-message [severity]="result.severity" styleClass="tb-form-message">{{
          result.text
        }}</p-message>
      }
      @if (status(); as status) {
        @if (status.connected) {
          <div class="tb-drive-state">
            <p-tag [value]="t.connected" severity="success" />
            <span class="tb-muted">{{
              t.since((status.connectedAt | date: 'dd.MM.yyyy HH:mm') ?? '')
            }}</span>
          </div>
          @if (status.account !== null) {
            <p class="tb-muted">{{ t.account(status.account) }}</p>
          }
          <p>{{ t.about(portalName()) }}</p>
          @if (status.running; as running) {
            <p class="tb-drive-running" role="status">
              <i class="pi pi-spin pi-spinner" aria-hidden="true"></i>
              {{
                running.task === 'UPLOAD' ? t.uploading(running.name) : t.downloading(running.name)
              }}
            </p>
          }
          @if (status.lastUploadAt !== null && status.lastUploadName !== null) {
            <small class="tb-muted">{{
              t.lastUpload(
                (status.lastUploadAt | date: 'dd.MM.yyyy HH:mm') ?? '',
                status.lastUploadName
              )
            }}</small>
          }
          @if (status.lastError !== null) {
            <p class="tb-error">{{ status.lastError }}</p>
          }
          <h3 class="tb-drive-files">{{ t.files }}</h3>
          @if (files().length === 0) {
            <tb-empty-state icon="pi-cloud" [title]="t.noFiles" />
          } @else {
            <ul class="tb-list" [attr.aria-label]="t.files">
              @for (file of files(); track file.id) {
                <li>
                  <span class="tb-list__lead" aria-hidden="true"><i class="pi pi-cloud"></i></span>
                  <div class="tb-list__text">
                    <span class="tb-list__title">{{ file.name }}</span>
                    <span class="tb-list__supporting">{{ details(file) }}</span>
                  </div>
                  <div class="tb-list__trail tb-list__trail--icons">
                    <p-button
                      icon="pi pi-download"
                      [text]="true"
                      [rounded]="true"
                      severity="secondary"
                      [pTooltip]="t.bringBack"
                      [ariaLabel]="t.bringBackLabel(file.name)"
                      [disabled]="onServer(file) || status.running !== null"
                      [loading]="actions.is('bring-' + file.id)"
                      (onClick)="bringBack(file)"
                    />
                  </div>
                </li>
              }
            </ul>
          }
          <p class="tb-muted">{{ t.restoreHint }}</p>
          <div class="tb-actions">
            <p-button
              [label]="t.disconnect"
              severity="danger"
              [text]="true"
              [loading]="actions.is('disconnect')"
              (onClick)="disconnect()"
            />
          </div>
        } @else {
          @if (status.lastError !== null) {
            <p-message severity="warn" styleClass="tb-form-message">{{ t.lost }}</p-message>
            <p class="tb-error">{{ status.lastError }}</p>
          }
          @if (status.clientConfigured && !editingClient()) {
            <p>{{ t.willCreate(portalName()) }}</p>
            <div class="tb-actions">
              <p-button
                [label]="t.connect"
                severity="secondary"
                icon="pi pi-google"
                [loading]="pending()"
                (onClick)="connect()"
              />
              @if (!status.clientFromEnvironment) {
                <p-button
                  [label]="t.editClient"
                  severity="secondary"
                  [text]="true"
                  (onClick)="editingClient.set(true)"
                />
              }
            </div>
          } @else {
            <p class="tb-muted">{{ t.setupIntro }}</p>
            <ol class="tb-drive-steps">
              <li>
                {{ t.open }}
                <a href="https://console.cloud.google.com/" target="_blank" rel="noopener"
                  >Google Cloud Console</a
                >
                {{ t.project }}
              </li>
              @for (step of t.steps; track $index) {
                <li>{{ step }}</li>
              }
              <li>
                {{ t.client }}
                <div class="tb-drive-uri">
                  <code>{{ redirectUri() }}</code>
                  <p-button
                    icon="pi pi-copy"
                    [text]="true"
                    [pTooltip]="t.copyAddress"
                    [rounded]="true"
                    severity="secondary"
                    [ariaLabel]="t.copyAddress"
                    (onClick)="copy(redirectUri())"
                  />
                </div>
                <small class="tb-muted">{{ t.httpsHint }}</small>
              </li>
              <li>{{ t.copyClient }}</li>
            </ol>
            <form tbFieldErrors class="tb-form" [formGroup]="form" (ngSubmit)="saveClient()">
              <div class="tb-field">
                <label for="drive-client-id">Client ID</label>
                <input
                  pInputText
                  id="drive-client-id"
                  formControlName="clientId"
                  autocomplete="off"
                />
              </div>
              <div class="tb-field">
                <label for="drive-client-secret">Client secret</label>
                <p-password
                  inputId="drive-client-secret"
                  formControlName="clientSecret"
                  [feedback]="false"
                  [toggleMask]="true"
                  [fluid]="true"
                >
                  <ng-template #showicon><tb-password-toggle /></ng-template>
                  <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
                </p-password>
              </div>
              <div class="tb-form-actions">
                @if (status.clientConfigured) {
                  <p-button
                    [label]="c.cancel"
                    severity="secondary"
                    [text]="true"
                    (onClick)="editingClient.set(false)"
                  />
                }
                <p-button
                  type="submit"
                  [label]="c.save"
                  severity="secondary"
                  [loading]="pending()"
                />
              </div>
            </form>
          }
        }
      }
    </p-card>
  `,
  styles: `
    .tb-drive-state {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      margin-bottom: var(--tb-space-3);
    }

    .tb-drive-running {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
    }

    .tb-drive-files {
      margin: var(--tb-space-4) 0 var(--tb-space-2);
      font: var(--tb-type-title-m);
      letter-spacing: var(--tb-tracking-title-m);
    }

    .tb-drive-steps {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      padding-left: var(--tb-space-5);
    }

    .tb-drive-uri {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      margin: var(--tb-space-1) 0;

      code {
        overflow-wrap: anywhere;
      }
    }

    .tb-actions {
      margin-top: var(--tb-space-3);
    }
  `,
})
export class DrivePanel implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.drive;
  protected readonly actions = new Busy();
  private readonly api = inject(BackupsApi);
  private readonly store = inject(DriveStore);
  private readonly navigation = inject(ExternalNavigation);
  private readonly portal = inject(Portal);
  private readonly clipboard = inject(Clipboard);
  private readonly snackbar = inject(Snackbar);
  private readonly route = inject(ActivatedRoute);

  protected readonly portalName = this.portal.name;
  protected readonly status = this.store.status;
  protected readonly files = this.store.files;
  protected readonly pending = signal(false);
  protected readonly editingClient = signal(false);
  protected readonly result = computed(() => {
    const code = this.resultCode();
    return code === null ? null : (DRIVE_RESULTS[code] ?? null);
  });
  protected readonly redirectUri = computed(() =>
    this.portal.link(this.status()?.callbackPath ?? '/api/public/backups/google/callback'),
  );

  readonly form = new FormGroup({
    clientId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
    clientSecret: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
  });

  private readonly resultCode = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.store.cancel();
    });
  }

  ngOnInit(): void {
    this.resultCode.set(this.route.snapshot.queryParamMap.get('drive'));
    this.store.load();
  }

  protected details(file: CloudBackup): string {
    const size = formatFileSize(file.size);
    return this.onServer(file) ? `${size} · ${this.t.onServer}` : size;
  }

  protected onServer(file: CloudBackup): boolean {
    return this.store.local().has(file.name);
  }

  saveClient(): void {
    if (!revealErrors(this.form) || this.pending()) {
      return;
    }
    const value = this.form.getRawValue();
    this.pending.set(true);
    this.api.saveDriveClient(value.clientId.trim(), value.clientSecret.trim()).subscribe({
      next: (status) => {
        this.pending.set(false);
        this.editingClient.set(false);
        this.form.reset();
        this.status.set(status);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  connect(): void {
    this.pending.set(true);
    this.api.authorizeDrive(this.navigation.origin()).subscribe({
      next: (response) => {
        this.navigation.go(response.url);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  disconnect(): void {
    this.actions.guard('disconnect', this.api.disconnectDrive()).subscribe(() => {
      this.resultCode.set(null);
      this.store.load();
    });
  }

  bringBack(file: CloudBackup): void {
    this.actions.guard('bring-' + file.id, this.api.downloadFromDrive(file.id)).subscribe(() => {
      this.snackbar.success(this.t.bringing(file.name));
      this.store.load();
    });
  }

  copy(text: string): void {
    if (this.clipboard.copy(text)) {
      this.snackbar.success(this.t.copied);
    }
  }
}
