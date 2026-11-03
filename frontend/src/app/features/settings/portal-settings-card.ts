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
import { SelectButton } from 'primeng/selectbutton';
import { DEFAULT_PORTAL_NAME, Portal, PortalSettings } from '@core/portal/portal';
import { MAX_PORTAL_NAME_LENGTH } from '@core/portal/portal-address';
import { guardUnsaved } from '@core/routing/unsaved-changes';
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

/**
 * Teacher: the name, the logo and the color of the portal (sketch Portal; the address — setup and
 * administrator). The draft applies on «Сохранить» of the floating bar; the preview shows it in both themes.
 */
@Component({
  selector: 'tb-portal-settings-card',
  imports: [
    Tooltip,
    ReactiveFormsModule,
    Button,
    Card,
    ColorPicker,
    HelpButton,
    InputText,
    Message,
    SelectButton,
    PortalLogo,
    FieldErrors,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (settings(); as settings) {
      <form tbFieldErrors id="portal" [formGroup]="form" (ngSubmit)="save()">
        <!-- sketch Portal: the cards of the draft in one column, the preview beside them -->
        <div class="tb-portal-grid">
          <div class="tb-stack">
            <p-card
              [header]="t.identityTitle"
              styleClass="tb-section-card tb-section-card--flow"
              class="tb-portal-identity"
            >
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
              <input
                #logoFile
                type="file"
                class="tb-sr-only"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                [attr.aria-label]="t.logoFile"
                (change)="uploadLogo(logoFile)"
              />
              <div class="tb-tiles">
                <div class="tb-tile">
                  <tb-portal-logo size="2.5rem" />
                  <span class="tb-tile__text">
                    <b>{{ t.logo }}</b>
                    <span>{{ t.logoHint }}</span>
                  </span>
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
                  <p-button
                    [label]="t.upload"
                    [ariaLabel]="t.uploadLogo"
                    icon="tb-i tb-i-upload"
                    severity="secondary"
                    [loading]="uploading()"
                    (onClick)="logoFile.click()"
                  />
                </div>
              </div>
            </p-card>

            <p-card
              [header]="t.appearanceTitle"
              styleClass="tb-section-card tb-section-card--flow"
              class="tb-portal-appearance"
            >
              <p id="portal-accent" class="tb-muted">{{ t.colorHint }}</p>
              <div class="tb-swatches" role="radiogroup" aria-labelledby="portal-accent">
                @for (accent of accents(); track accent.value) {
                  <button
                    type="button"
                    role="radio"
                    class="tb-swatch"
                    [attr.aria-checked]="!own() && form.controls.accent.value === accent.value"
                    (click)="chooseAccent(accent.value)"
                  >
                    <span
                      class="tb-swatch__dot"
                      [style.background]="accent.swatch.background"
                      [style.color]="accent.swatch.color"
                    >
                      @if (!own() && form.controls.accent.value === accent.value) {
                        <i class="tb-i tb-i-check" aria-hidden="true"></i>
                      }
                    </span>
                    {{ accent.label }}
                  </button>
                }
                <button
                  type="button"
                  role="radio"
                  class="tb-swatch"
                  [attr.aria-checked]="own()"
                  [attr.aria-label]="t.ownColor"
                  (click)="chooseOwn()"
                >
                  <span
                    class="tb-swatch__dot tb-swatch__dot--own"
                    [style.background]="own() ? ownSwatch().background : null"
                    [style.color]="own() ? ownSwatch().color : null"
                  >
                    <i
                      [class]="own() ? 'tb-i tb-i-check' : 'tb-i tb-i-palette'"
                      aria-hidden="true"
                    ></i>
                  </span>
                  {{ t.ownShort }}
                </button>
              </div>
              <div class="tb-own-color">
                <div class="tb-field tb-grow">
                  <label for="portal-own-color">{{ t.ownColorField }}</label>
                  <input
                    pInputText
                    id="portal-own-color"
                    [formControl]="ownColor"
                    maxlength="7"
                    placeholder="#0f766e"
                    (input)="ownTyped()"
                  />
                </div>
                <!-- the dot opens the palette of the own color -->
                <p-colorpicker
                  class="tb-own-color__picker"
                  [formControl]="ownColor"
                  appendTo="body"
                  (onChange)="ownTyped()"
                />
              </div>
              @if (poorContrast(); as advice) {
                <p-message severity="warn" styleClass="tb-form-message">{{ advice }}</p-message>
              }
              @if (advice().likeError) {
                <p-message severity="warn" styleClass="tb-form-message">{{
                  t.likeError
                }}</p-message>
              }
            </p-card>

            <p-card styleClass="tb-section-card tb-section-card--flow" class="tb-portal-fine">
              <ng-template #header>
                <button
                  type="button"
                  class="tb-portal-fold"
                  [attr.aria-expanded]="fineOpen()"
                  aria-controls="portal-fine"
                  (click)="fineOpen.set(!fineOpen())"
                >
                  <span class="tb-portal-fold__text">
                    <b>{{ t.fineTitle }}</b>
                    <span>{{ fineSummary() }}</span>
                  </span>
                  <i
                    class="tb-i tb-muted"
                    [class]="fineOpen() ? 'tb-i-expand_less' : 'tb-i-expand_more'"
                    aria-hidden="true"
                  ></i>
                </button>
              </ng-template>
              @if (fineOpen()) {
                <span id="portal-scheme" class="tb-section-label"
                  >{{ t.scheme }} <tb-help-button topic="teacher/appearance"
                /></span>
                <div
                  id="portal-fine"
                  class="tb-schemes"
                  role="radiogroup"
                  aria-labelledby="portal-scheme"
                >
                  @for (option of schemeOptions(); track option.value) {
                    <button
                      type="button"
                      role="radio"
                      class="tb-scheme"
                      [id]="'portal-scheme-' + option.value"
                      [attr.aria-checked]="schemeType() === option.value"
                      (click)="chooseScheme(option.value)"
                    >
                      <span class="tb-scheme__sample" aria-hidden="true">
                        <i [style.background]="option.roles.primary"></i>
                        <i [style.background]="option.roles.secondaryContainer"></i>
                        <i [style.background]="option.roles.tertiaryContainer"></i>
                      </span>
                      <span class="tb-scheme__label">
                        @if (schemeType() === option.value) {
                          <i class="tb-i tb-i-check" aria-hidden="true"></i>
                        }
                        {{ option.label }}
                      </span>
                    </button>
                  }
                </div>
                <span id="portal-contrast" class="tb-section-label">{{ t.contrast }}</span>
                <p-selectbutton
                  formControlName="contrast"
                  [options]="contrasts"
                  optionLabel="label"
                  optionValue="value"
                  [allowEmpty]="false"
                  [fluid]="true"
                  ariaLabelledBy="portal-contrast"
                  (onChange)="form.controls.contrast.markAsDirty()"
                >
                  <ng-template #item let-option>
                    @if (option.value === contrastLevel()) {
                      <i class="tb-i tb-i-check" aria-hidden="true"></i>
                    }
                    {{ option.label }}
                  </ng-template>
                </p-selectbutton>
                <small class="tb-hint">{{ t.contrastHint }}</small>
                @if (advice().adjusted) {
                  <p-message severity="info" icon="tb-i tb-i-info" styleClass="tb-form-message">{{
                    t.adjusted
                  }}</p-message>
                }
              }
            </p-card>
          </div>

          <p-card
            [header]="t.preview"
            styleClass="tb-section-card tb-section-card--flow"
            class="tb-portal-preview"
          >
            <p class="tb-muted">{{ t.previewAbout }}</p>
            <div
              class="tb-look"
              [style.background]="scheme().light.surface"
              [style.color]="scheme().light.onSurface"
              [style.border-color]="scheme().light.outlineVariant"
            >
              <div class="tb-look__bar" [style.background]="scheme().light.surfaceContainer">
                <tb-portal-logo size="1.5rem" />
                <b>{{ draftName() || defaultName }}</b>
              </div>
              <div class="tb-look__body">
                <div
                  class="tb-look__hero"
                  [style.background]="scheme().light.primaryContainer"
                  [style.color]="scheme().light.onPrimaryContainer"
                >
                  <span class="tb-look__overline">{{ t.previewLesson }}</span>
                  <b class="tb-look__student">{{ t.previewStudent }}</b>
                  <span
                    class="tb-look__button"
                    [style.background]="scheme().light.primary"
                    [style.color]="scheme().light.onPrimary"
                    >{{ t.previewAction }}</span
                  >
                </div>
                <div class="tb-look__row" [style.background]="scheme().light.surfaceContainerLow">
                  <span
                    class="tb-look__icon"
                    [style.background]="scheme().light.secondaryContainer"
                    [style.color]="scheme().light.onSecondaryContainer"
                    ><i class="tb-i tb-i-assignment" aria-hidden="true"></i
                  ></span>
                  <b class="tb-grow">{{ t.previewQueue }}</b>
                  <span class="tb-look__link" [style.color]="scheme().light.primary">{{
                    t.previewOpen
                  }}</span>
                </div>
              </div>
            </div>
            <div
              class="tb-look tb-look--dark"
              [style.background]="scheme().dark.surface"
              [style.color]="scheme().dark.onSurface"
              [style.border-color]="scheme().dark.outlineVariant"
            >
              <i
                class="tb-i tb-i-dark_mode"
                [style.color]="scheme().dark.primary"
                aria-hidden="true"
              ></i>
              <span class="tb-grow">{{ t.darkTheme }}</span>
              <span
                class="tb-look__button"
                [style.background]="scheme().dark.primary"
                [style.color]="scheme().dark.onPrimary"
                >{{ t.previewAction }}</span
              >
            </div>
          </p-card>
        </div>
        @if (form.dirty) {
          <div class="tb-savebar" role="status">
            {{ unsavedText() }}
            <p-button
              type="button"
              [label]="t.discard"
              [text]="true"
              styleClass="tb-savebar__discard"
              (onClick)="cancel()"
            />
            <p-button
              type="submit"
              [label]="c.save"
              styleClass="tb-savebar__save"
              [loading]="pending()"
            />
          </div>
        }
      </form>
    }
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }

    /* sketch Portal: the draft and the preview side by side while each gets 360 px, else one column */
    .tb-portal-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 22.5rem), 1fr));
      align-items: start;
      gap: var(--tb-space-4);
    }

    /* the colors: five in a row, the dot over its name (the sketch); ours: 40 px dots, 12 px apart */
    .tb-swatches {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: var(--tb-space-3);
    }

    .tb-swatch {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      min-width: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--p-md-on-surface-variant);
      font: var(--tb-type-body-s);
      text-align: center;
      overflow-wrap: anywhere;
      cursor: pointer;

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
        border-radius: var(--tb-shape-sm);
      }
    }

    .tb-swatch__dot {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--tb-shape-full);
    }

    .tb-swatch[aria-checked='true'] {
      color: var(--p-md-on-surface);

      .tb-swatch__dot {
        outline: 3px solid var(--p-md-on-surface);
        outline-offset: 3px;
      }
    }

    .tb-swatch__dot--own {
      box-sizing: border-box;
      border: 1px solid var(--p-md-outline-variant);
      color: var(--p-md-on-surface-variant);
    }

    .tb-own-color {
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
    }

    /* the palette's trigger is the 40 px dot of the own color */
    .tb-own-color__picker ::ng-deep .p-colorpicker-preview {
      width: 2.5rem;
      height: 2.5rem;
      border: 0;
      border-radius: var(--tb-shape-full);
    }

    /* «Тонкая настройка»: the card's head is the fold button (the sketch) */
    @media (width >= 37.5em) {
      .tb-portal-fine ::ng-deep .p-card-header {
        padding: var(--tb-space-5) var(--tb-space-5) 0;
      }
    }

    .tb-portal-fold {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      width: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
        border-radius: var(--tb-shape-sm);
      }
    }

    .tb-portal-fold__text {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;

      b {
        font: var(--tb-type-title-m-emphasized);
      }

      span {
        color: var(--p-md-on-surface-variant);
        font: var(--tb-type-body-m);
      }
    }

    /* the schemes: three in a row, an outlined tile with the sample of its colors (the sketch) */
    .tb-schemes {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--tb-space-2);
    }

    .tb-scheme {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      min-width: 0;
      padding: var(--tb-space-2);
      border: 1px solid var(--p-md-outline-variant);
      border-radius: var(--tb-shape-md);
      background: transparent;
      color: var(--p-md-on-surface);
      font: var(--tb-type-label-l);
      text-align: start;
      cursor: pointer;

      &[aria-checked='true'] {
        border-color: var(--p-md-secondary-container);
        background: var(--p-md-secondary-container);
        color: var(--p-md-on-secondary-container);
      }

      &:focus-visible {
        outline: 3px solid var(--p-md-secondary);
        outline-offset: 2px;
      }
    }

    .tb-scheme__sample {
      display: flex;
      gap: 2px;
      width: 100%;
      height: 1.25rem;
      overflow: hidden;
      border-radius: 6px;

      i {
        flex: 1;
      }
    }

    .tb-scheme__label {
      display: flex;
      align-items: center;
      gap: var(--tb-space-1);
      overflow-wrap: anywhere;

      .tb-i {
        font-size: 1rem;
      }
    }

    /* the preview: the portal in miniature in its light and dark theme */
    .tb-look {
      overflow: hidden;
      border: 1px solid;
      border-radius: var(--tb-shape-lg);
    }

    .tb-look__bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: var(--tb-space-3) var(--tb-space-4);
      font: var(--tb-type-title-s);
    }

    .tb-look__body {
      display: flex;
      flex-direction: column;
      gap: var(--tb-space-3);
      padding: var(--tb-space-4);
    }

    .tb-look__hero {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      padding: var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
    }

    .tb-look__overline {
      font: var(--tb-type-label-m-emphasized);
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .tb-look__student {
      font: var(--tb-type-title-m-emphasized);
    }

    .tb-look__button {
      display: inline-flex;
      align-items: center;
      height: 2.5rem;
      padding: 0 var(--tb-space-4);
      border-radius: var(--tb-shape-full);
      font: var(--tb-type-label-l);
      white-space: nowrap;
    }

    .tb-look__row {
      display: flex;
      align-items: center;
      gap: var(--tb-space-4);
      min-height: 3.5rem;
      padding: var(--tb-space-2) var(--tb-space-4);
      border-radius: var(--tb-shape-lg);
      font: var(--tb-type-body-l);
    }

    .tb-look__icon {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--tb-shape-full);
    }

    .tb-look__link {
      font: var(--tb-type-label-l);
    }

    .tb-look--dark {
      display: flex;
      align-items: center;
      gap: var(--tb-space-3);
      padding: var(--tb-space-3) var(--tb-space-4);
      font: var(--tb-type-body-m);
    }

    /* the floating save bar (the sketch, an M3 snackbar's look): inverse surface, inverse-primary actions */
    .tb-savebar {
      position: sticky;
      bottom: var(--tb-space-6);
      z-index: 1;
      display: flex;
      align-items: center;
      gap: var(--tb-space-2);
      width: fit-content;
      max-width: 100%;
      margin: var(--tb-space-4) auto 0;
      padding: var(--tb-space-2) var(--tb-space-2) var(--tb-space-2) var(--tb-space-5);
      border-radius: var(--tb-shape-lg);
      background: var(--p-md-inverse-surface);
      color: var(--p-md-inverse-on-surface);
      box-shadow: 0 4px 12px rgb(0 0 0 / 25%);
      font: var(--tb-type-body-m);

      ::ng-deep .tb-savebar__discard.p-button {
        color: var(--p-md-inverse-primary);
      }

      ::ng-deep .tb-savebar__save.p-button {
        border-color: var(--p-md-inverse-primary);
        background: var(--p-md-inverse-primary);
        color: var(--p-md-on-primary-container);
      }
    }

    @container (width < 26rem) {
      .tb-schemes {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
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
  private readonly customMode = signal(false);
  /** «Тонкая настройка» starts open (sketch Portal). */
  protected readonly fineOpen = signal(true);
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
  protected readonly schemeOptions = computed(() =>
    SCHEMES.map((value) => ({
      value,
      label: T.portal.schemes[value],
      roles: accentScheme(this.accent(), { scheme: value, contrast: this.contrastLevel() }).light,
    })),
  );
  protected readonly fineSummary = computed(() =>
    T.portal.fineSummary(
      T.portal.schemes[this.schemeType()],
      T.portal.contrasts[this.contrastLevel()].toLowerCase(),
    ),
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
    guardUnsaved(() => this.form.dirty);
    this.ownColor.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((color) => {
      if (this.own() && isOwnColor(color)) {
        // The palette and the text field share the control: the one not typed in follows.
        this.ownColor.setValue(color, { emitEvent: false });
        this.form.controls.accent.setValue(color.toLowerCase());
        this.form.controls.accent.markAsDirty();
      }
    });
  }

  /** «Свой цвет»: the last own color, or a calm default. */
  chooseOwn(): void {
    this.customMode.set(true);
    const color = this.ownColor.value;
    this.form.controls.accent.setValue(isOwnColor(color) ? color.toLowerCase() : DEFAULT_OWN_COLOR);
    this.form.controls.accent.markAsDirty();
  }

  /** A color typed or picked: the own color becomes the accent once it is a valid `#rrggbb`. */
  ownTyped(): void {
    this.customMode.set(true);
    const color = this.ownColor.value;
    if (isOwnColor(color)) {
      this.form.controls.accent.setValue(color.toLowerCase());
      this.form.controls.accent.markAsDirty();
    }
  }

  ngOnInit(): void {
    this.api.portal().subscribe((settings) => {
      this.show(settings);
    });
  }

  chooseScheme(value: SchemeType): void {
    this.form.controls.scheme.setValue(value);
    this.form.controls.scheme.markAsDirty();
  }

  /** The text of the save bar: what the draft changes. */
  protected unsavedText(): string {
    const { name, accent, scheme, contrast } = this.form.controls;
    const look = accent.dirty || scheme.dirty || contrast.dirty;
    if (look && name.dirty) {
      return T.portal.unsaved;
    }
    return look ? T.portal.colorChanged : T.portal.nameChanged;
  }

  chooseAccent(value: string): void {
    this.customMode.set(false);
    this.form.controls.accent.setValue(value);
    this.form.controls.accent.markAsDirty();
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
