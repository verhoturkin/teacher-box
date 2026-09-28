import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { DEFAULT_PORTAL_NAME, Portal, PortalSettings } from '@core/portal/portal';
import { MAX_PORTAL_NAME_LENGTH, portalAddressValidator } from '@core/portal/portal-address';
import { PortalAddressField } from '@core/portal/portal-address-field';
import { HelpButton } from '@features/help/parts';
import { SettingsApi } from './data-access/settings-api';

/** Teacher: the name of the portal and its address. */
@Component({
  selector: 'tb-portal-settings-card',
  imports: [ReactiveFormsModule, Button, Card, HelpButton, InputText, PortalAddressField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card header="Портал" id="portal">
      <tb-help-button topic="teacher/setup" label="Подробнее" />
      @if (settings(); as settings) {
        <form class="tb-form" [formGroup]="form" (ngSubmit)="save()">
          <div class="tb-field">
            <label for="portal-name">Название</label>
            <input
              pInputText
              id="portal-name"
              formControlName="name"
              [placeholder]="defaultName"
              [maxlength]="maxNameLength"
              autocomplete="off"
            />
            <small class="tb-hint"
              >Видно в шапке портала, во вкладке браузера, на странице входа и в календаре.</small
            >
          </div>
          <tb-portal-address-field
            [control]="form.controls.address"
            [fromEnvironment]="settings.addressFromEnvironment"
          />
          <div class="tb-actions">
            <p-button
              type="submit"
              label="Сохранить"
              [disabled]="form.invalid"
              [loading]="pending()"
            />
          </div>
        </form>
      }
    </p-card>
  `,
})
export class PortalSettingsCard implements OnInit {
  private readonly api = inject(SettingsApi);
  private readonly portal = inject(Portal);
  private readonly messages = inject(MessageService);

  protected readonly defaultName = DEFAULT_PORTAL_NAME;
  protected readonly maxNameLength = MAX_PORTAL_NAME_LENGTH;
  protected readonly settings = signal<PortalSettings | null>(null);
  protected readonly pending = signal(false);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PORTAL_NAME_LENGTH)],
    }),
    address: new FormControl('', { nonNullable: true, validators: [portalAddressValidator] }),
  });

  ngOnInit(): void {
    this.api.portal().subscribe((settings) => {
      this.show(settings);
    });
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }
    this.pending.set(true);
    const { name, address } = this.form.getRawValue();
    this.api.changePortal(name, address).subscribe({
      next: (settings) => {
        this.pending.set(false);
        this.show(settings);
        this.portal.set(settings);
        this.messages.add({
          severity: 'success',
          summary: 'Сохранено',
          detail: 'Название и адрес портала сохранены',
        });
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  private show(settings: PortalSettings): void {
    this.settings.set(settings);
    this.form.reset({ name: settings.name, address: settings.address ?? '' });
  }
}
