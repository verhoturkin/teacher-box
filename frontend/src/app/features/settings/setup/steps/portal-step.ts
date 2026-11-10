import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { DEFAULT_PORTAL_NAME, Portal } from '@core/portal/portal';
import { PortalAddressField } from '@core/portal/portal-address-field';
import { PortalLogo } from '@core/portal/portal-logo';
import { Account, ProfilePhoto, TeacherNameField } from '@features/identity/parts';
import { PortalNameField } from '@features/settings/fields/portal-name-field';
import { T } from '@features/settings/i18n/texts';
import { FieldErrors } from '@shared/ui/field-errors';
import { nonEmpty } from './setup-state';

/** The fields of «Вы и портал». */
export type PortalForm = FormGroup<{
  teacherName: FormControl<string>;
  portalName: FormControl<string>;
  address: FormControl<string>;
}>;

/** «Вы и портал»: the photo and the name, the portal's name and address. */
@Component({
  selector: 'tb-setup-portal-step',
  imports: [
    ReactiveFormsModule,
    Card,
    FieldErrors,
    PortalAddressField,
    PortalNameField,
    ProfilePhoto,
    TeacherNameField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <form
      tbFieldErrors
      id="setup-portal"
      class="tb-stack"
      [formGroup]="form()"
      (ngSubmit)="submitted.emit()"
    >
      <button type="submit" class="tb-sr-only" tabindex="-1" aria-hidden="true"></button>
      <p-card [header]="t.aboutYou" styleClass="tb-section-card tb-section-card--flow">
        @if (account(); as account) {
          <tb-profile-photo
            [account]="account"
            [hint]="t.photoLater"
            (changed)="photoChanged.emit($event)"
          />
        }
        <tb-teacher-name-field
          inputId="setup-teacher-name"
          [label]="t.teacherName"
          [control]="form().controls.teacherName"
        />
      </p-card>
      <p-card [header]="t.portalCard" styleClass="tb-section-card tb-section-card--flow">
        <tb-portal-name-field inputId="setup-portal-name" [control]="form().controls.portalName" />
        <tb-portal-address-field
          inputId="setup-address"
          [checkable]="true"
          [control]="form().controls.address"
        />
      </p-card>
    </form>
  `,
})
export class SetupPortalStep {
  protected readonly t = T.setup;
  readonly form = input.required<PortalForm>();
  readonly account = input.required<Account | null>();
  /** «Далее» by Enter in a field. */
  readonly submitted = output();
  readonly photoChanged = output<Account>();
}

/** What a student sees of the portal: its sign-in page and the invitation (sketch OnbPortal). */
@Component({
  selector: 'tb-setup-portal-preview',
  imports: [PortalLogo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: contents' },
  template: `
    <div class="tb-setup__preview tb-setup__preview--center">
      <div class="tb-setup__login">
        <tb-portal-logo size="2.5rem" />
        <b class="tb-setup__login-name">{{ portalName() }}</b>
        <span class="tb-muted">{{ t.studentSignIn }}</span>
        <span class="tb-setup__login-field"></span>
        <span class="tb-setup__login-field"></span>
        <span class="tb-setup__login-button">{{ t.signIn }}</span>
      </div>
      <p class="tb-setup__bubble">
        {{ t.invite(teacherName(), portalName()) }}
        <span class="tb-setup__link">{{ inviteLink() }}</span>
      </p>
    </div>
  `,
  styles: `
    .tb-setup__preview {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-5);
      border-radius: var(--tb-shape-lg-increased, 1.25rem);
      background: var(--p-md-surface-container);
    }

    .tb-setup__preview--center {
      align-items: center;
    }

    .tb-setup__login {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-2);
      align-items: center;
      width: 100%;
      max-width: 20rem;
      padding: var(--tb-space-5);
      border-radius: var(--tb-shape-lg-increased, 1.25rem);
      background: var(--p-md-surface);
      text-align: center;
    }

    .tb-setup__login-name {
      font: var(--tb-type-title-l);
    }

    .tb-setup__login-field {
      width: 100%;
      height: 2.5rem;
      border-radius: var(--tb-shape-xs) var(--tb-shape-xs) 0 0;
      background: var(--p-md-surface-container-highest);
    }

    .tb-setup__login-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 2.5rem;
      border-radius: var(--tb-shape-full);
      background: var(--p-md-primary);
      color: var(--p-md-on-primary);
      font: var(--tb-type-label-l);
    }

    .tb-setup__bubble {
      align-self: stretch;
      margin: 0;
      padding: var(--tb-space-3) var(--tb-space-4);
      border-radius: var(--tb-shape-lg) var(--tb-shape-lg) var(--tb-shape-lg) var(--tb-shape-xs);
      background: var(--p-md-surface-container-lowest);
      font: var(--tb-type-body-m);
      overflow-wrap: anywhere;
    }

    .tb-setup__link {
      color: var(--p-md-primary);
    }
  `,
})
export class SetupPortalPreview {
  protected readonly t = T.setup;
  private readonly portal = inject(Portal);
  /** The fields of «Вы и портал» as they are typed. */
  readonly values =
    input.required<Partial<{ teacherName: string; portalName: string; address: string }>>();

  protected readonly portalName = computed(
    () => nonEmpty(this.values().portalName?.trim()) ?? DEFAULT_PORTAL_NAME,
  );
  protected readonly teacherName = computed(() => this.values().teacherName?.trim() ?? '');
  protected readonly inviteLink = computed(() => {
    const address = nonEmpty(this.values().address?.trim()) ?? this.portal.openedAt();
    return `${address.replace(/^https?:\/\//, '')}/invite/…`;
  });
}
