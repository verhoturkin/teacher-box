import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { ColorPicker } from 'primeng/colorpicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { DEFAULT_PORTAL_NAME, Portal, PortalSettings } from '@core/portal/portal';
import { MAX_PORTAL_NAME_LENGTH, portalAddressValidator } from '@core/portal/portal-address';
import { PortalAddressField } from '@core/portal/portal-address-field';
import { PortalLogo } from '@core/portal/portal-logo';
import {
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_OWN_COLOR,
  MIN_CONTRAST,
  accentAdvice,
  accentScheme,
  isOwnColor,
} from '@core/theme/portal-accent';
import { HelpButton } from '@features/help/parts';
import { SettingsApi } from './data-access/settings-api';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';

/** The largest logo the server takes, bytes. */
const MAX_LOGO_SIZE = 1024 * 1024;

/** Teacher: the name, the address, the color and the logo of the portal. */
@Component({
  selector: 'tb-portal-settings-card',
  imports: [
    ReactiveFormsModule,
    Button,
    Card,
    ColorPicker,
    HelpButton,
    InputText,
    Message,
    PortalAddressField,
    PortalLogo,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-card id="portal">
      <ng-template #title>
        <div class="tb-card-title">
          <span class="tb-card-title__text">Портал <tb-help-button topic="teacher/setup" /></span>
        </div>
      </ng-template>
      @if (settings(); as settings) {
        <form tbFieldErrors class="tb-form" [formGroup]="form" (ngSubmit)="save()">
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
              <button
                type="button"
                role="radio"
                class="tb-accent tb-accent--own"
                [attr.aria-checked]="own()"
                aria-label="Свой цвет"
                title="Свой цвет"
                [style.background]="own() ? accent() : null"
                (click)="chooseOwn()"
              >
                <i [class]="own() ? 'pi pi-check' : 'pi pi-palette'" aria-hidden="true"></i>
              </button>
            </div>
            @if (own()) {
              <div class="tb-own-color">
                <p-colorpicker [formControl]="ownColor" appendTo="body" />
                <div class="tb-field tb-grow">
                  <label for="portal-own-color">Свой цвет, #rrggbb</label>
                  <input
                    pInputText
                    id="portal-own-color"
                    [formControl]="ownColor"
                    maxlength="7"
                    placeholder="#0f766e"
                  />
                </div>
                <!-- the buttons as they will be: the tones of the roles, not the shades (ADR-0023) -->
                <span
                  class="tb-own-color__sample"
                  [style.background]="scheme().light.primary"
                  [style.color]="scheme().light.onPrimary"
                  >Светлая тема</span
                >
                <span
                  class="tb-own-color__sample"
                  [style.background]="scheme().dark.primary"
                  [style.color]="scheme().dark.onPrimary"
                  >Тёмная тема</span
                >
              </div>
              @if (poorContrast(); as advice) {
                <p-message severity="warn" styleClass="tb-form-message">{{ advice }}</p-message>
              }
              @if (advice().adjusted) {
                <small class="tb-hint"
                  >Чтобы текст читался, кнопки и ссылки будут темнее выбранного цвета (в тёмной теме
                  — светлее), как на образцах.</small
                >
              }
            }
            @if (advice().likeSuccess) {
              <p-message severity="warn" styleClass="tb-form-message"
                >Кнопки подтверждения («Сохранить», «Принять») зелёные — с этим цветом портала
                главное действие раздела будет трудно отличить от них.</p-message
              >
            }
            @if (advice().likeError) {
              <p-message severity="warn" styleClass="tb-form-message"
                >Кнопки отмены и удаления красные — с этим цветом портала главное действие раздела
                будет похоже на них.</p-message
              >
            }
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
                [loading]="uploading()"
                (onClick)="logoFile.click()"
              />
              @if (settings.logo !== null) {
                <p-button
                  label="Убрать"
                  severity="danger"
                  [text]="true"
                  [loading]="busy.is('logo')"
                  (onClick)="removeLogo()"
                />
              }
            </div>
            <small class="tb-hint">
              PNG, JPEG, WebP или SVG до 1 МБ, лучше квадратный. Виден в шапке, на странице входа и
              во вкладке браузера.
            </small>
          </div>
          <div class="tb-form-actions">
            <p-button
              class="tb-tonal"
              type="submit"
              label="Сохранить"
              severity="success"
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

    .tb-accent--own {
      border-color: var(--p-content-border-color);
      background: var(--p-content-background);
      color: var(--p-text-muted-color);

      &[aria-checked='true'] {
        color: #fff;
      }
    }

    .tb-own-color {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);

      .tb-field {
        flex: 0 1 11rem;
      }
    }

    .tb-own-color__sample {
      padding: var(--tb-space-2) var(--tb-space-3);
      border-radius: var(--p-border-radius-md);
      font-weight: 500;
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
  protected readonly busy = new Busy();
  private readonly api = inject(SettingsApi);
  private readonly portal = inject(Portal);
  private readonly snackbar = inject(Snackbar);

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
  /** The own color being picked; it becomes the accent while it is a valid `#rrggbb`. */
  readonly ownColor = new FormControl(DEFAULT_OWN_COLOR, { nonNullable: true });

  protected readonly accent = toSignal(this.form.controls.accent.valueChanges, {
    initialValue: this.form.controls.accent.value,
  });
  protected readonly own = computed(() => isOwnColor(this.accent()));
  protected readonly scheme = computed(() =>
    accentScheme(this.own() ? this.accent() : DEFAULT_OWN_COLOR),
  );
  /** Whether the color was made darker to stay readable, whether it looks like green or red buttons. */
  protected readonly advice = computed(() => accentAdvice(this.accent()));
  /** Advice when a text in the own color would be poorly readable (ADR-0023). */
  protected readonly poorContrast = computed(() => {
    if (!this.own()) {
      return null;
    }
    const { light, dark } = this.advice();
    const poor = [light < MIN_CONTRAST && 'светлой', dark < MIN_CONTRAST && 'тёмной'].filter(
      (theme) => theme !== false,
    );
    if (poor.length > 0) {
      return `Текст на кнопках в этом цвете будет плохо читаться в ${poor.join(' и ')} теме — выберите цвет насыщеннее или темнее.`;
    }
    return null;
  });

  constructor() {
    this.ownColor.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((color) => {
      if (this.own() && isOwnColor(color)) {
        // The palette and the text field share the control: the one not typed in follows.
        this.ownColor.setValue(color, { emitEvent: false });
        this.form.controls.accent.setValue(color.toLowerCase());
      }
    });
  }

  /** «Свой цвет»: the last own color, or a calm default. */
  chooseOwn(): void {
    const color = this.ownColor.value;
    this.form.controls.accent.setValue(isOwnColor(color) ? color.toLowerCase() : DEFAULT_OWN_COLOR);
  }

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
    const { name, address, accent } = this.form.getRawValue();
    this.api.changePortal(name, address, accent).subscribe({
      next: (settings) => {
        this.pending.set(false);
        this.show(settings);
        this.portal.set(settings);
        this.snackbar.success('Настройки портала сохранены');
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
      this.snackbar.error('Файл больше 1 МБ');
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
    this.busy.guard('logo', this.api.removeLogo()).subscribe((settings) => {
      this.settings.set(settings);
      this.portal.set(settings);
    });
  }

  private show(settings: PortalSettings): void {
    this.settings.set(settings);
    if (isOwnColor(settings.accent)) {
      this.ownColor.setValue(settings.accent, { emitEvent: false });
    }
    this.form.reset({
      name: settings.name,
      address: settings.address ?? '',
      accent: settings.accent,
    });
  }
}
