import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Portal, PortalSettings } from '@core/portal/portal';
import { portalAddressValidator } from '@core/portal/portal-address';
import { PortalAddressField } from '@core/portal/portal-address-field';
import { HelpButton } from '@features/help/parts';
import { AdminApi } from '../data-access/admin-api';
import { revealErrors } from '@shared/ui/field-errors';
import { Snackbar } from '@core/snackbar/snackbar';

/** Administrator: the address of the portal (a setting of the server); the name is the teacher's. */
@Component({
  selector: 'tb-portal-address-card',
  imports: [ReactiveFormsModule, Button, Card, HelpButton, PortalAddressField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card>
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text"
            >Адрес портала <tb-help-button topic="admin/backups"
          /></span>
        </div>
      </ng-template>
      @if (settings(); as settings) {
        <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
          <tb-portal-address-field
            [control]="form.controls.address"
            [fromEnvironment]="settings.addressFromEnvironment"
          />
          @if (!settings.addressFromEnvironment) {
            <div class="tb-form-actions">
              <p-button
                class="tb-tonal"
                type="submit"
                label="Сохранить адрес"
                severity="success"
                [loading]="pending()"
              />
            </div>
          }
        </form>
      }
    </p-card>
  `,
})
export class PortalAddressCard implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly portal = inject(Portal);
  private readonly snackbar = inject(Snackbar);

  protected readonly settings = signal<PortalSettings | null>(null);
  protected readonly pending = signal(false);

  readonly form = new FormGroup({
    address: new FormControl('', { nonNullable: true, validators: [portalAddressValidator] }),
  });

  ngOnInit(): void {
    this.api.portal().subscribe((settings) => {
      this.show(settings);
    });
  }

  save(): void {
    if (!revealErrors(this.form)) {
      return;
    }
    this.pending.set(true);
    this.api.changePortalAddress(this.form.controls.address.value).subscribe({
      next: (settings) => {
        this.pending.set(false);
        this.show(settings);
        this.portal.set(settings);
        this.snackbar.success('Адрес портала сохранён');
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  private show(settings: PortalSettings): void {
    this.settings.set(settings);
    this.form.reset({ address: settings.address ?? '' });
  }
}
