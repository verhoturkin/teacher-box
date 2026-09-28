import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { DEFAULT_PORTAL_NAME, Portal, PortalSettings } from '@core/portal/portal';
import { MAX_PORTAL_NAME_LENGTH, portalAddressValidator } from '@core/portal/portal-address';
import { PortalAddressField } from '@core/portal/portal-address-field';
import { PortalLogo } from '@core/portal/portal-logo';
import { ACCENTS, DEFAULT_ACCENT } from '@core/theme/portal-accent';
import { HelpButton } from '@features/help/parts';
import { SettingsApi } from './data-access/settings-api';

/** The largest logo the server takes, bytes. */
const MAX_LOGO_SIZE = 1024 * 1024;

/** Teacher: the name, the address, the color and the logo of the portal. */
@Component({
  selector: 'tb-portal-settings-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    HelpButton,
    InputText,
    PortalAddressField,
    PortalLogo,
  ],
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
          <div class="tb-field">
            <span id="portal-accent">Цвет</span>
            <div class="tb-accents" role="radiogroup" aria-labelledby="portal-accent">
              @for (accent of accents; track accent.value) {
                <button
                  type="button"
                  role="radio"
                  class="tb-accent"
                  [attr.aria-checked]="form.controls.accent.value === accent.value"
                  [attr.aria-label]="accent.label"
                  [title]="accent.label"
                  [style.background]="'var(--p-' + accent.value + '-500)'"
                  (click)="form.controls.accent.setValue(accent.value)"
                >
                  @if (form.controls.accent.value === accent.value) {
                    <i class="pi pi-check" aria-hidden="true"></i>
                  }
                </button>
              }
            </div>
            <small class="tb-hint">Кнопки, ссылки и выделения портала — в этом цвете.</small>
          </div>
          <div class="tb-field">
            <span>Логотип</span>
            <div class="tb-logo-row">
              <tb-portal-logo size="2.5rem" />
              <input
                #logoFile
                type="file"
                class="tb-sr-only"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                aria-label="Файл логотипа"
                (change)="uploadLogo(logoFile)"
              />
              <p-button
                label="Загрузить логотип"
                icon="pi pi-upload"
                severity="secondary"
                [outlined]="true"
                [loading]="uploading()"
                (onClick)="logoFile.click()"
              />
              @if (settings.logo !== null) {
                <p-button
                  label="Убрать"
                  severity="secondary"
                  [text]="true"
                  (onClick)="removeLogo()"
                />
              }
            </div>
            <small class="tb-hint">
              PNG, JPEG, WebP или SVG до 1 МБ, лучше квадратный. Виден в шапке, на странице входа и
              во вкладке браузера.
            </small>
          </div>
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
  styles: `
    .tb-accents {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-3);
    }

    .tb-accent {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border: 2px solid transparent;
      border-radius: 50%;
      color: #fff;
      cursor: pointer;

      &[aria-checked='true'] {
        border-color: var(--p-text-color);
      }

      &:focus-visible {
        outline: 2px solid var(--p-primary-color);
        outline-offset: 2px;
      }
    }

    .tb-logo-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-3);
    }
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
  protected readonly uploading = signal(false);
  protected readonly accents = ACCENTS;

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PORTAL_NAME_LENGTH)],
    }),
    address: new FormControl('', { nonNullable: true, validators: [portalAddressValidator] }),
    accent: new FormControl<string>(DEFAULT_ACCENT, { nonNullable: true }),
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
    const { name, address, accent } = this.form.getRawValue();
    this.api.changePortal(name, address, accent).subscribe({
      next: (settings) => {
        this.pending.set(false);
        this.show(settings);
        this.portal.set(settings);
        this.messages.add({
          severity: 'success',
          summary: 'Сохранено',
          detail: 'Настройки портала сохранены',
        });
      },
      error: () => {
        this.pending.set(false);
      },
    });
  }

  uploadLogo(input: HTMLInputElement): void {
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (file === null) {
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      this.messages.add({ severity: 'warn', summary: 'Логотип', detail: 'Файл больше 1 МБ' });
      return;
    }
    this.uploading.set(true);
    this.api.uploadLogo(file).subscribe({
      next: (settings) => {
        this.uploading.set(false);
        this.settings.set(settings);
        this.portal.set(settings);
      },
      error: () => {
        this.uploading.set(false);
      },
    });
  }

  removeLogo(): void {
    this.api.removeLogo().subscribe((settings) => {
      this.settings.set(settings);
      this.portal.set(settings);
    });
  }

  private show(settings: PortalSettings): void {
    this.settings.set(settings);
    this.form.reset({
      name: settings.name,
      address: settings.address ?? '',
      accent: settings.accent,
    });
  }
}
