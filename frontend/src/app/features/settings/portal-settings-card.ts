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
import { ColorPicker } from 'primeng/colorpicker';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { RadioButton } from 'primeng/radiobutton';
import { DEFAULT_PORTAL_NAME, Portal, PortalSettings } from '@core/portal/portal';
import { MAX_PORTAL_NAME_LENGTH } from '@core/portal/portal-address';
import { PortalLogo } from '@core/portal/portal-logo';
import { Tooltip } from 'primeng/tooltip';
import {
  DEFAULT_ACCENT,
  DEFAULT_OWN_COLOR,
  MIN_CONTRAST,
  accentAdvice,
  accentScheme,
  accentSwatch,
  isOwnColor,
  isAccent,
} from '@core/theme/portal-accent';
import { HelpButton } from '@features/help/parts';
import { SettingsApi } from './data-access/settings-api';
import { FieldErrors, revealErrors } from '@shared/ui/field-errors';
import { Snackbar } from '@core/snackbar/snackbar';
import { Busy } from '@shared/ui/busy';
import { T } from './i18n/texts';
import { SHARED_T } from '@shared/i18n/texts';
import {
  BASE_COLORS,
  CONTRASTS,
  ContrastLevel,
  DEFAULT_APPEARANCE,
  SCHEMES,
  SchemeType,
} from '@core/theme/appearance';

/** The largest logo the server takes, bytes. */
const MAX_LOGO_SIZE = 1024 * 1024;

/** Teacher: the name, the color and the logo of the portal (the address — setup and administrator). */
@Component({
  selector: 'tb-portal-settings-card',
  imports: [
    Tooltip,
    ReactiveFormsModule,
    Button,
    ColorPicker,
    HelpButton,
    InputText,
    Message,
    RadioButton,
    PortalLogo,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (settings(); as settings) {
      <form tbFieldErrors id="portal" class="tb-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="tb-portal-grid">
          <section
            class="tb-portal-card tb-portal-identity"
            aria-labelledby="portal-identity-title"
          >
            <h3 id="portal-identity-title">{{ t.identityTitle }}</h3>
            <div class="tb-field">
              <label for="portal-name">{{ t.name }}</label>
              <input
                pInputText
                id="portal-name"
                formControlName="name"
                [placeholder]="defaultName"
                [maxlength]="maxNameLength"
                autocomplete="off"
              />
              <small class="tb-hint">{{ t.nameHint }}</small>
            </div>
            <div class="tb-field">
              <span>{{ t.logo }}</span>
              <input
                #logoFile
                type="file"
                class="tb-sr-only"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                [attr.aria-label]="t.logoFile"
                (change)="uploadLogo(logoFile)"
              />
              <div class="tb-logo-row">
                <tb-portal-logo size="2.5rem" round />
                <p-button
                  [label]="t.upload"
                  [ariaLabel]="t.uploadLogo"
                  icon="tb-i tb-i-upload"
                  severity="secondary"
                  [loading]="uploading()"
                  (onClick)="logoFile.click()"
                />
                @if (settings.logo !== null) {
                  <p-button
                    icon="tb-i tb-i-delete"
                    severity="danger"
                    [text]="true"
                    [rounded]="true"
                    [pTooltip]="t.removeLogo"
                    [ariaLabel]="t.removeLogo"
                    [loading]="busy.is('logo')"
                    (onClick)="removeLogo()"
                  />
                }
              </div>
              <small class="tb-hint">{{ t.logoHint }}</small>
            </div>
          </section>
          <section
            class="tb-portal-card tb-portal-appearance"
            aria-labelledby="portal-appearance-title"
          >
            <h3 id="portal-appearance-title">{{ t.appearanceTitle }}</h3>
            <section class="tb-portal-section">
              <div class="tb-field">
                <span id="portal-accent">{{ t.color }}</span>
                <div class="tb-accents" role="radiogroup" aria-labelledby="portal-accent">
                  @for (accent of accents(); track accent.value) {
                    <button
                      type="button"
                      role="radio"
                      class="tb-accent"
                      [attr.aria-checked]="!own() && form.controls.accent.value === accent.value"
                      [attr.aria-label]="accent.label"
                      [title]="accent.label"
                      [style.background]="accent.swatch.background"
                      [style.color]="accent.swatch.color"
                      (click)="chooseAccent(accent.value)"
                    >
                      @if (!own() && form.controls.accent.value === accent.value) {
                        <i class="tb-i tb-i-check" aria-hidden="true"></i>
                      }
                    </button>
                  }
                  <button
                    type="button"
                    role="radio"
                    class="tb-accent tb-accent--own"
                    [attr.aria-checked]="own()"
                    [attr.aria-label]="t.ownColor"
                    [title]="t.ownColor"
                    [style.background]="own() ? ownSwatch().background : null"
                    [style.color]="own() ? ownSwatch().color : null"
                    (click)="chooseOwn()"
                  >
                    <i
                      [class]="own() ? 'tb-i tb-i-check' : 'tb-i tb-i-palette'"
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>
                @if (own()) {
                  <div class="tb-own-color">
                    <p-colorpicker [formControl]="ownColor" appendTo="body" />
                    <div class="tb-field tb-grow">
                      <label for="portal-own-color">{{ t.ownColorField }}</label>
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
                      >{{ t.lightTheme }}</span
                    >
                    <span
                      class="tb-own-color__sample"
                      [style.background]="scheme().dark.primary"
                      [style.color]="scheme().dark.onPrimary"
                      >{{ t.darkTheme }}</span
                    >
                  </div>
                  @if (poorContrast(); as advice) {
                    <p-message severity="warn" styleClass="tb-form-message">{{ advice }}</p-message>
                  }
                  @if (advice().adjusted) {
                    <small class="tb-hint">{{ t.adjusted }}</small>
                  }
                }
                @if (advice().likeError) {
                  <p-message severity="warn" styleClass="tb-form-message">{{
                    t.likeError
                  }}</p-message>
                }
                <small class="tb-hint">{{ t.colorHint }}</small>
              </div>
            </section>
            <section class="tb-portal-section" [attr.aria-label]="t.scheme">
              <h3>{{ t.scheme }} <tb-help-button topic="teacher/appearance" /></h3>
              <div class="tb-scheme-grid" role="radiogroup" [attr.aria-label]="t.scheme">
                @for (option of schemeOptions(); track option.value) {
                  <label
                    class="tb-scheme-option"
                    [for]="'portal-scheme-' + option.value"
                    [class.tb-scheme-selected]="schemeType() === option.value"
                  >
                    <span class="tb-scheme-colors" aria-hidden="true">
                      <span [style.background]="option.roles.primary"></span>
                      <span [style.background]="option.roles.secondaryContainer"></span>
                      <span [style.background]="option.roles.tertiaryContainer"></span>
                    </span>
                    <span class="tb-scheme-label"
                      ><p-radiobutton
                        formControlName="scheme"
                        [value]="option.value"
                        [inputId]="'portal-scheme-' + option.value"
                      />{{ option.label }}</span
                    >
                  </label>
                }
              </div>
            </section>
            <section class="tb-portal-section" [attr.aria-label]="t.contrast">
              <h3>{{ t.contrast }}</h3>
              <div class="tb-contrast-options" role="radiogroup" [attr.aria-label]="t.contrast">
                @for (option of contrasts; track option.value) {
                  <label [for]="'portal-contrast-' + option.value"
                    ><p-radiobutton
                      formControlName="contrast"
                      [value]="option.value"
                      [inputId]="'portal-contrast-' + option.value"
                    />{{ option.label }}</label
                  >
                }
              </div>
              <small class="tb-hint">{{ t.contrastHint }}</small>
            </section>
          </section>
          <aside
            class="tb-portal-card tb-portal-preview"
            [style.background]="previewRoles().surfaceContainer"
            [style.color]="previewRoles().onSurface"
            [attr.aria-label]="t.preview"
          >
            <div class="tb-preview-header">
              <h3>{{ t.preview }}</h3>
              <p-button
                type="button"
                [label]="darkPreview() ? t.darkTheme : t.lightTheme"
                severity="secondary"
                (onClick)="darkPreview.set(!darkPreview())"
              />
            </div>
            <strong>{{ draftName() || defaultName }}</strong>
            <div
              class="tb-preview-hero"
              [style.background]="previewRoles().primaryContainer"
              [style.color]="previewRoles().onPrimaryContainer"
            >
              <small>{{ t.previewLesson }}</small>
              <h3>{{ t.previewStudent }}</h3>
              <span
                class="tb-preview-action"
                [style.background]="previewRoles().primary"
                [style.color]="previewRoles().onPrimary"
                >{{ t.previewAction }}</span
              >
            </div>
            <div class="tb-preview-tonal" [style.background]="previewRoles().surfaceContainerHigh">
              {{ t.previewQueue }}
            </div>
            <small>{{ t.previewHint }}</small>
          </aside>
        </div>
        <div class="tb-form-actions">
          <p-button
            type="button"
            [label]="c.cancel"
            severity="secondary"
            [text]="true"
            (onClick)="cancel()"
          />
          <p-button type="submit" [label]="c.save" severity="secondary" [loading]="pending()" />
        </div>
      </form>
    }
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    .tb-portal-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
      gap: var(--tb-space-6);
    }
    .tb-portal-card {
      --tb-field-surface: var(--tb-list-item);
      min-width: 0;
      padding: var(--tb-space-5);
      background: var(--tb-field-surface);
      border-radius: var(--tb-shape-lg-plus);
    }
    .tb-portal-card > h3 {
      margin: 0;
    }
    .tb-portal-identity,
    .tb-portal-appearance {
      display: grid;
      gap: var(--tb-space-6);
      align-content: start;
    }
    .tb-portal-section {
      display: grid;
      gap: var(--tb-space-3);
    }
    .tb-portal-preview {
      padding: var(--tb-space-5);
      border-radius: var(--tb-shape-lg-plus);
      display: grid;
      gap: var(--tb-space-4);
    }
    .tb-preview-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: var(--tb-space-2);
    }
    .tb-preview-hero {
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-md);
    }
    .tb-preview-action {
      display: inline-block;
      padding: var(--tb-space-2) var(--tb-space-4);
      border-radius: var(--tb-shape-full);
    }
    .tb-preview-tonal {
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-md);
    }
    .tb-scheme-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--tb-space-3);
    }
    .tb-scheme-option {
      display: grid;
      gap: var(--tb-space-3);
      padding: var(--tb-space-3);
      border: 2px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-md);
      color: var(--p-md-on-surface);
      background: var(--tb-list-item);
      cursor: pointer;
      font: inherit;
      text-align: start;
    }
    .tb-scheme-option.tb-scheme-selected {
      border-color: var(--p-md-primary);
    }
    .tb-scheme-colors {
      display: flex;
      gap: var(--tb-space-1);
    }
    .tb-scheme-label {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
    }
    .tb-scheme-colors span {
      flex: 1;
      height: var(--tb-space-6);
      border-radius: var(--tb-shape-xs);
    }
    .tb-contrast-options {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-4);
    }
    .tb-contrast-options label {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      min-height: calc(var(--tb-space-6) * 2);
    }
    .tb-contrast-options input {
      accent-color: var(--p-md-primary);
    }
    @container (width >= 48em) {
      .tb-portal-grid {
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      }
      .tb-portal-identity,
      .tb-portal-appearance {
        grid-column: 1;
      }
      .tb-portal-preview {
        grid-column: 2;
        grid-row: 1 / span 2;
      }
    }
    @container (width < 37.5em) {
      .tb-portal-grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .tb-scheme-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .tb-accents {
      display: flex;
      flex-wrap: wrap;
      gap: var(--tb-space-3);
    }

    .tb-accent {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      border: 2px solid transparent;
      border-radius: var(--tb-shape-full);
      cursor: pointer;

      &[aria-checked='true'] {
        border-color: var(--p-md-on-surface);
      }

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }
    }

    .tb-accent--own {
      border-color: var(--p-md-outline-variant);
      background: var(--tb-card);
      color: var(--p-md-on-surface-variant);
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
      border-radius: var(--tb-shape-md);
      font-weight: 500;
    }

    /* the logo, «Загрузить» and the bin keep one line on a 360 px phone */
    .tb-logo-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--tb-space-2);
    }
  `,
})
export class PortalSettingsCard implements OnInit {
  protected readonly c = SHARED_T.common;
  protected readonly t = T.portal;
  protected readonly busy = new Busy();
  private readonly api = inject(SettingsApi);
  private readonly portal = inject(Portal);
  private readonly snackbar = inject(Snackbar);

  protected readonly defaultName = DEFAULT_PORTAL_NAME;
  protected readonly maxNameLength = MAX_PORTAL_NAME_LENGTH;
  protected readonly settings = signal<PortalSettings | null>(null);
  protected readonly pending = signal(false);
  protected readonly uploading = signal(false);
  protected readonly accents = computed(() => {
    const base = BASE_COLORS.map((accent) => ({
      value: accent.value,
      label: T.portal.baseColors[accent.name],
      swatch: accentSwatch(accent.value),
    }));
    const current = this.accent();
    return isAccent(current) && current !== DEFAULT_ACCENT
      ? [{ value: current, label: T.portal.currentColor, swatch: accentSwatch(current) }, ...base]
      : base;
  });
  protected readonly darkPreview = signal(false);
  private readonly customMode = signal(false);
  protected readonly contrasts = CONTRASTS.map((value) => ({
    value,
    label: T.portal.contrasts[value],
  }));

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PORTAL_NAME_LENGTH)],
    }),
    /** Not edited here (the setup and the administrator set it): sent back as it is. */
    address: new FormControl('', { nonNullable: true }),
    accent: new FormControl<string>(DEFAULT_ACCENT, { nonNullable: true }),
    scheme: new FormControl<SchemeType>(DEFAULT_APPEARANCE.scheme, { nonNullable: true }),
    contrast: new FormControl<ContrastLevel>(DEFAULT_APPEARANCE.contrast, { nonNullable: true }),
  });
  /** The own color being picked; it becomes the accent while it is a valid `#rrggbb`. */
  readonly ownColor = new FormControl(DEFAULT_OWN_COLOR, { nonNullable: true });

  protected readonly accent = toSignal(this.form.controls.accent.valueChanges, {
    initialValue: this.form.controls.accent.value,
  });
  protected readonly own = computed(
    () =>
      this.customMode() ||
      (isOwnColor(this.accent()) && !BASE_COLORS.some((color) => color.value === this.accent())),
  );
  protected readonly schemeType = toSignal(this.form.controls.scheme.valueChanges, {
    initialValue: DEFAULT_APPEARANCE.scheme,
  });
  protected readonly contrastLevel = toSignal(this.form.controls.contrast.valueChanges, {
    initialValue: DEFAULT_APPEARANCE.contrast,
  });
  protected readonly draftName = toSignal(this.form.controls.name.valueChanges, {
    initialValue: '',
  });
  protected readonly appearance = computed(() => ({
    scheme: this.schemeType(),
    contrast: this.contrastLevel(),
  }));
  protected readonly previewRoles = computed(() =>
    this.darkPreview() ? this.scheme().dark : this.scheme().light,
  );
  protected readonly schemeOptions = computed(() =>
    SCHEMES.map((value) => ({
      value,
      label: T.portal.schemes[value],
      roles: accentScheme(this.accent(), { scheme: value, contrast: this.contrastLevel() }).light,
    })),
  );
  protected readonly ownSwatch = computed(() => accentSwatch(this.accent()));
  protected readonly scheme = computed(() => accentScheme(this.accent(), this.appearance()));
  /** Whether the color was made darker to stay readable, whether it looks like the red buttons. */
  protected readonly advice = computed(() => accentAdvice(this.accent(), this.appearance()));
  /** Advice when a text in the own color would be poorly readable (ADR-0023). */
  protected readonly poorContrast = computed(() => {
    if (!this.own()) {
      return null;
    }
    const { light, dark } = this.advice();
    const poorLight = light < MIN_CONTRAST;
    const poorDark = dark < MIN_CONTRAST;
    if (poorLight && poorDark) {
      return T.portal.poorBoth;
    }
    if (poorLight || poorDark) {
      return poorLight ? T.portal.poorLight : T.portal.poorDark;
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
    this.customMode.set(true);
    const color = this.ownColor.value;
    this.form.controls.accent.setValue(isOwnColor(color) ? color.toLowerCase() : DEFAULT_OWN_COLOR);
  }

  ngOnInit(): void {
    this.api.portal().subscribe((settings) => {
      this.show(settings);
    });
  }

  chooseAccent(value: string): void {
    this.customMode.set(false);
    this.form.controls.accent.setValue(value);
  }

  cancel(): void {
    const settings = this.settings();
    if (settings) this.show(settings);
  }

  save(): void {
    if (!revealErrors(this.form)) {
      return;
    }
    this.pending.set(true);
    const { name, address, accent, scheme, contrast } = this.form.getRawValue();
    this.api.changePortal(name, address, accent, { scheme, contrast }).subscribe({
      next: (settings) => {
        this.pending.set(false);
        this.show(settings);
        this.portal.set(settings);
        this.snackbar.success(T.portal.saved);
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
      this.snackbar.error(T.portal.logoTooLarge);
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
    this.customMode.set(false);
    this.settings.set(settings);
    if (isOwnColor(settings.accent)) {
      this.ownColor.setValue(settings.accent, { emitEvent: false });
    }
    this.form.reset({
      name: settings.name,
      address: settings.address ?? '',
      accent: settings.accent,
      scheme: settings.scheme ?? DEFAULT_APPEARANCE.scheme,
      contrast: settings.contrast ?? DEFAULT_APPEARANCE.contrast,
    });
  }
}
