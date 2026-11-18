import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Button } from 'primeng/button';
import { CopyField } from '@shared/ui/copy-field';
import { Card } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { Tag } from 'primeng/tag';
import { HelpButton } from '@features/help/parts';
import { Portal } from '@core/portal/portal';
import { ExternalNavigation } from '@shared/navigation/external-navigation';
import { ScheduleApi } from '../data-access/schedule-api';
import { GoogleCalendarStatus } from '../data-access/schedule.models';
import { PasswordToggle } from '@shared/ui/password-toggle';
import { FieldErrors } from '@shared/ui/field-errors';
import { TbDialog } from '@shared/ui/dialog/dialog';
import { dialogSubmit } from '@shared/ui/dialog/dialog-submit';
import { openedOnce } from '@shared/ui/dialog/opened-once';
import { guardUnsaved } from '@core/routing/unsaved-changes';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { T } from '../i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';

type Severity = 'success' | 'info' | 'warn' | 'error';

/** Messages for the result Google's redirect brings back (`?google=...`). */
export const AUTHORIZATION_RESULTS: Readonly<Record<string, { severity: Severity; text: string }>> =
  {
    connected: {
      severity: 'success',
      text: T.google.connectedResult,
    },
    denied: { severity: 'warn', text: T.google.denied },
    expired: {
      severity: 'warn',
      text: T.google.expired,
    },
    failed: { severity: 'error', text: T.google.failed },
  };

/**
 * The teacher's Google Calendar as a state: connected — the account, sync and disconnecting; not
 * connected — one line and «Подключить Google», which opens the Google Cloud steps and the OAuth
 * client in a dialog (once the client is saved, it goes to Google's consent page).
 */
@Component({
  selector: 'tb-google-calendar-panel',
  imports: [
    HelpButton,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    Button,
    CopyField,
    Card,
    Checkbox,
    InputText,
    Message,
    Password,
    Tag,
    PasswordToggle,
    FieldErrors,
    TbDialog,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="google" styleClass="tb-section-card tb-section-card--flow">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >{{ t.title }} <tb-help-button topic="teacher/calendars"
          /></span>
        </div>
      </ng-template>
      @if (result(); as result) {
        <p-message [severity]="result.severity" styleClass="tb-form-message">{{
          result.text
        }}</p-message>
      }
      @if (status(); as status) {
        @switch (status.status) {
          @case ('CONNECTED') {
            <div class="tb-tiles tb-google-state">
              <div class="tb-tile">
                <i class="tb-i tb-i-sync tb-tile__icon" aria-hidden="true"></i>
                <span class="tb-tile__text">
                  <b>{{ t.about }}</b>
                  <span>{{ t.since((status.connectedAt | date: 'dd.MM.yyyy HH:mm') ?? '') }}</span>
                </span>
                <p-tag [value]="t.connected" severity="success" />
              </div>
            </div>
            @if (status.lastSyncAt !== null) {
              <small class="tb-muted">{{
                t.lastSync((status.lastSyncAt | date: 'dd.MM.yyyy HH:mm') ?? '')
              }}</small>
            }
            @if (status.busyEnabled) {
              <p class="tb-muted">{{ t.busyShown }}</p>
            }
            @if (status.lastError !== null) {
              <p class="tb-error">{{ status.lastError }}</p>
            }
            <div class="tb-actions">
              <p-button
                [label]="t.sync"
                icon="tb-i tb-i-refresh"
                severity="secondary"
                [loading]="pending()"
                (onClick)="sync()"
              />
              <p-button
                [label]="t.disconnect"
                severity="danger"
                [text]="true"
                [loading]="actions.is('disconnect')"
                (onClick)="disconnect()"
              />
            </div>
          }
          @default {
            @if (status.status === 'NEEDS_RECONNECT') {
              <p-message severity="warn" styleClass="tb-form-message">{{ t.reconnect }}</p-message>
            }
            @if (status.clientConfigured) {
              <p>{{ t.willCreate(portalName()) }}</p>
              <label class="tb-switch" for="google-busy">
                <p-checkbox [(ngModel)]="busy" [binary]="true" inputId="google-busy" />
                <span>{{ t.showBusy }}</span>
              </label>
            } @else {
              <p class="tb-muted">{{ t.notConnected }}</p>
            }
            @if (status.lastError !== null) {
              <p class="tb-error">{{ status.lastError }}</p>
            }
            <div class="tb-actions">
              <p-button
                [label]="t.connect"
                severity="secondary"
                icon="tb-i tb-i-link"
                [loading]="pending()"
                (onClick)="status.clientConfigured ? connect() : setupOpen.set(true)"
              />
              @if (status.clientConfigured) {
                <p-button
                  [label]="t.editClient"
                  severity="secondary"
                  [text]="true"
                  (onClick)="setupOpen.set(true)"
                />
              }
            </div>
          }
        }
      }
    </p-card>
    @if (setupBuilt()) {
      <tb-dialog
        kind="form"
        width="wide"
        [(visible)]="setupOpen"
        [headline]="t.setup"
        [confirmLabel]="c.save"
        formId="google-client-form"
        [pending]="submit.pending()"
        [error]="submit.error()"
        [dirty]="submit.dirty()"
      >
        <ol class="tb-google-steps">
          <li>
            {{ t.open }}
            <a href="https://console.cloud.google.com/" target="_blank" rel="noopener"
              >Google Cloud Console</a
            >
            {{ t.createProject }}
          </li>
          <li>{{ t.enableApi }} <strong>Google Calendar API</strong>.</li>
          <li>
            {{ t.consentBefore }} <strong>External</strong>{{ t.consentMiddle }}
            <strong>Publish app</strong> {{ t.consentAfter }}
          </li>
          <li>
            {{ t.clientBefore }} <strong>Web application</strong>{{ t.clientAfter }}
            <tb-copy-field
              class="tb-google-uri"
              [value]="redirectUri()"
              [copyLabel]="t.copyAddress"
              [copiedText]="t.copied"
            />
            <small class="tb-muted">{{ t.httpsHint }}</small>
          </li>
          <li>{{ t.copyClient }}</li>
        </ol>
        <form
          id="google-client-form"
          tbFieldErrors
          class="tb-form"
          [formGroup]="form"
          (ngSubmit)="submit.run()"
        >
          <div class="tb-field">
            <label for="google-client-id">Client ID</label>
            <input pInputText id="google-client-id" formControlName="clientId" autocomplete="off" />
          </div>
          <div class="tb-field">
            <label for="google-client-secret">Client secret</label>
            <p-password
              inputId="google-client-secret"
              formControlName="clientSecret"
              [feedback]="false"
              [toggleMask]="true"
              [fluid]="true"
            >
              <ng-template #showicon><tb-password-toggle /></ng-template>
              <ng-template #hideicon><tb-password-toggle [shown]="true" /></ng-template>
            </p-password>
          </div>
        </form>
      </tb-dialog>
    }
  `,
  styles: `
    .tb-google-state {
      margin-bottom: var(--tb-space-3);
    }

    .tb-google-steps {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      margin: 0 0 var(--tb-space-4);
      padding-left: var(--tb-hint-indent);
    }

    .tb-google-uri {
      margin: var(--tb-space-1) 0;
    }

    .tb-actions {
      margin-top: var(--tb-space-3);
    }
  `,
})
export class GoogleCalendarPanel implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.google;
  protected readonly actions = new Busy();
  private readonly api = inject(ScheduleApi);
  private readonly navigation = inject(ExternalNavigation);
  private readonly portal = inject(Portal);

  protected readonly portalName = this.portal.name;
  private readonly snackbar = inject(Snackbar);
  private readonly route = inject(ActivatedRoute);

  protected readonly status = signal<GoogleCalendarStatus | null>(null);
  protected readonly pending = signal(false);
  /** The setup dialog: the Google Cloud steps and the OAuth client. */
  protected readonly setupOpen = signal(false);
  protected readonly setupBuilt = openedOnce(this.setupOpen);
  protected readonly busy = signal(false);
  protected readonly result = computed(() => {
    const code = this.resultCode();
    return code === null ? null : (AUTHORIZATION_RESULTS[code] ?? null);
  });
  protected readonly redirectUri = computed(() =>
    this.portal.link(this.status()?.callbackPath ?? '/api/public/schedule/google/callback'),
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

  protected readonly submit = dialogSubmit({
    visible: this.setupOpen,
    form: this.form,
    failed: T.google.saveFailed,
    request: (value) => this.api.saveGoogleClient(value.clientId.trim(), value.clientSecret.trim()),
    done: (status) => {
      this.status.set(status);
    },
  });

  private readonly resultCode = signal<string | null>(null);

  constructor() {
    guardUnsaved(() => this.setupOpen() && this.form.dirty);
  }

  ngOnInit(): void {
    this.resultCode.set(this.route.snapshot.queryParamMap.get('google'));
    this.load();
  }

  connect(): void {
    this.pending.set(true);
    this.api.authorizeGoogle(this.navigation.origin(), this.busy()).subscribe({
      next: (response) => {
        this.navigation.go(response.url);
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  sync(): void {
    this.pending.set(true);
    this.api.syncGoogle().subscribe({
      next: (response) => {
        this.pending.set(false);
        this.snackbar.success(T.google.changed(response.changed));
        this.load();
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  disconnect(): void {
    this.actions.guard('disconnect', this.api.disconnectGoogle()).subscribe(() => {
      this.resultCode.set(null);
      this.load();
    });
  }

  private load(): void {
    this.api.googleStatus().subscribe((status) => {
      this.status.set(status);
      this.busy.set(status.busyEnabled);
    });
  }
}
