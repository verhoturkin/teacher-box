/**
 * The only module of the app that imports `@material/material-color-utilities` (ADR-0034, stage 376):
 * it computes the M3 roles of a portal colour and of the label colours. The app reaches it through
 * `import()` only (`portal-accent.ts`, the settings) — `scripts/initial-imports.mjs` fails when a static
 * import chain from `main.ts` gets here; the roles of the default appearance and of the labels are
 * constants (`generated-colors.ts`, `npm run colors`).
 */
import {
  ColorGroup,
  CustomColorGroup,
  DynamicScheme,
  Hct,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  argbFromHex,
  customColor,
  hexFromArgb,
} from '@material/material-color-utilities';
import { readable, toOklch } from './color';
import { Appearance, CONTRAST_LEVELS, DEFAULT_APPEARANCE } from './appearance';
import { ColorScheme, Roles, Shades, auraPalette, shade } from './color-scheme';
import type { LabelRoles } from './label-colors';

const SCHEME_TYPES = {
  fidelity: SchemeFidelity,
  'tonal-spot': SchemeTonalSpot,
  vibrant: SchemeVibrant,
  expressive: SchemeExpressive,
  neutral: SchemeNeutral,
  monochrome: SchemeMonochrome,
  content: SchemeContent,
  rainbow: SchemeRainbow,
  'fruit-salad': SchemeFruitSalad,
} as const;

const SCRIM = 'rgb(0 0 0 / 32%)';

/** M3 tones of the neutral palette as shades 0–950 (PrimeNG's surface palette). */
const NEUTRAL_TONES: Readonly<Record<string, number>> = {
  '0': 99,
  '50': 98,
  '100': 95,
  '200': 90,
  '300': 80,
  '400': 70,
  '500': 60,
  '600': 50,
  '700': 40,
  '800': 30,
  '900': 20,
  '950': 10,
};

function hex(argb: number): string {
  return hexFromArgb(argb).toLowerCase();
}

/**
 * The M3 roles of one theme (ADR-0034): the dynamic scheme of `@material/material-color-utilities`
 * (Fidelity — the primary and its container keep the chosen color; the 2025 spec — M3 Expressive) and the custom colors success and warning harmonized with
 * the seed.
 */
function m3Roles(scheme: DynamicScheme, success: ColorGroup, warning: ColorGroup): Roles {
  return {
    primary: hex(scheme.primary),
    onPrimary: hex(scheme.onPrimary),
    primaryContainer: hex(scheme.primaryContainer),
    onPrimaryContainer: hex(scheme.onPrimaryContainer),
    secondary: hex(scheme.secondary),
    secondaryContainer: hex(scheme.secondaryContainer),
    onSecondaryContainer: hex(scheme.onSecondaryContainer),
    tertiary: hex(scheme.tertiary),
    tertiaryContainer: hex(scheme.tertiaryContainer),
    onTertiaryContainer: hex(scheme.onTertiaryContainer),
    error: hex(scheme.error),
    onError: hex(scheme.onError),
    errorContainer: hex(scheme.errorContainer),
    onErrorContainer: hex(scheme.onErrorContainer),
    success: hex(success.color),
    onSuccess: hex(success.onColor),
    successContainer: hex(success.colorContainer),
    onSuccessContainer: hex(success.onColorContainer),
    warning: hex(warning.color),
    onWarning: hex(warning.onColor),
    warningContainer: hex(warning.colorContainer),
    onWarningContainer: hex(warning.onColorContainer),
    surface: hex(scheme.surface),
    surfaceContainerLowest: hex(scheme.surfaceContainerLowest),
    surfaceContainerLow: hex(scheme.surfaceContainerLow),
    surfaceContainer: hex(scheme.surfaceContainer),
    surfaceContainerHigh: hex(scheme.surfaceContainerHigh),
    surfaceContainerHighest: hex(scheme.surfaceContainerHighest),
    onSurface: hex(scheme.onSurface),
    onSurfaceVariant: hex(scheme.onSurfaceVariant),
    outline: hex(scheme.outline),
    outlineVariant: hex(scheme.outlineVariant),
    inverseSurface: hex(scheme.inverseSurface),
    inverseOnSurface: hex(scheme.inverseOnSurface),
    inversePrimary: hex(scheme.inversePrimary),
    scrim: SCRIM,
  };
}

/** Moves `text` away from `ground`: lighter on a darker ground, darker on a lighter one. */
function away(text: string, ground: string): 'lighter' | 'darker' {
  return toOklch(text).l >= toOklch(ground).l ? 'lighter' : 'darker';
}

/**
 * Text roles keep the portal's contrast (ADR-0023): 4.5:1 to every surface they stand on — the page,
 * cards, tiles — and to the text on them. M3 tones mostly have it already; a role short of it is moved
 * along its hue. The primary container (the hero card, saturated in Fidelity) carries only its own
 * text role.
 */
function readableRoles(roles: Roles, dark: boolean): Roles {
  const direction = dark ? 'lighter' : 'darker';
  const grounds = [
    roles.surface,
    roles.surfaceContainerLowest,
    roles.surfaceContainerLow,
    roles.surfaceContainer,
    roles.surfaceContainerHigh,
    roles.surfaceContainerHighest,
  ];
  const filled = (color: string, on: string): string =>
    readable(color, [on, ...grounds], direction);
  const on = (text: string, ground: string): string => readable(text, [ground], away(text, ground));
  return {
    ...roles,
    primary: filled(roles.primary, roles.onPrimary),
    onPrimaryContainer: on(roles.onPrimaryContainer, roles.primaryContainer),
    onSecondaryContainer: on(roles.onSecondaryContainer, roles.secondaryContainer),
    onTertiaryContainer: on(roles.onTertiaryContainer, roles.tertiaryContainer),
    onErrorContainer: on(roles.onErrorContainer, roles.errorContainer),
    onSuccessContainer: on(roles.onSuccessContainer, roles.successContainer),
    onWarningContainer: on(roles.onWarningContainer, roles.warningContainer),
    onSurface: readable(roles.onSurface, grounds, direction),
    secondary: readable(roles.secondary, grounds, direction),
    tertiary: readable(roles.tertiary, grounds, direction),
    error: filled(roles.error, roles.onError),
    success: filled(roles.success, roles.onSuccess),
    warning: filled(roles.warning, roles.onWarning),
    onSurfaceVariant: readable(roles.onSurfaceVariant, grounds, direction),
    inversePrimary: on(roles.inversePrimary, roles.inverseSurface),
  };
}

/**
 * The scheme of a portal color from its shades 50–950 (ADR-0034): the shade 500 is the seed of the M3
 * dynamic scheme computed by `@material/material-color-utilities`; the shades stay PrimeNG's primary
 * palette. Green and amber of Aura are the custom colors success and warning.
 */
export function colorScheme(
  primary: Shades,
  appearance: Appearance = DEFAULT_APPEARANCE,
): ColorScheme {
  const seed = argbFromHex(shade(primary, '500'));
  const source = Hct.fromInt(seed);
  const Factory = SCHEME_TYPES[appearance.scheme];
  const light = new Factory(source, false, CONTRAST_LEVELS[appearance.contrast], '2025');
  const dark = new Factory(source, true, CONTRAST_LEVELS[appearance.contrast], '2025');
  const custom = (palette: string, name: string): CustomColorGroup =>
    customColor(seed, {
      value: argbFromHex(shade(auraPalette(palette), '500')),
      name,
      blend: true,
    });
  const success = custom('green', 'success');
  const warning = custom('amber', 'warning');
  const neutral: Shades = Object.fromEntries(
    Object.entries(NEUTRAL_TONES).map(([name, tone]) => [
      name,
      hex(light.neutralPalette.tone(tone)),
    ]),
  );
  return {
    primary,
    neutral,
    light: readableRoles(m3Roles(light, success.light, warning.light), false),
    dark: readableRoles(m3Roles(dark, success.dark, warning.dark), true),
  };
}

/** Text is readable from this contrast on (WCAG 2.2, 1.4.3). */
const TEXT = 4.5;

/**
 * The roles of a label colour from its reference colour: the M3 Fidelity scheme (2025 spec); an on-role
 * short of 4.5:1 is moved along its hue (ADR-0023), the text of the surfaces — away from every surface a
 * row takes, as the portal's text roles are.
 */
export function computeLabelRoles(reference: string, dark: boolean): LabelRoles {
  const scheme = new SchemeFidelity(Hct.fromInt(argbFromHex(reference)), dark, 0, '2025');
  const color = hex(scheme.primary);
  const container = hex(scheme.primaryContainer);
  const on = (text: string, ground: string): string =>
    readable(text, [ground], away(text, ground), TEXT);
  const surfaceContainerLowest = hex(scheme.surfaceContainerLowest);
  const surfaceContainerLow = hex(scheme.surfaceContainerLow);
  const surfaceContainerHigh = hex(scheme.surfaceContainerHigh);
  const surfaces = [surfaceContainerLowest, surfaceContainerLow, surfaceContainerHigh];
  const direction = dark ? 'lighter' : 'darker';
  return {
    color,
    onColor: on(hex(scheme.onPrimary), color),
    container,
    onContainer: on(hex(scheme.onPrimaryContainer), container),
    surfaceContainerLowest,
    surfaceContainerLow,
    surfaceContainerHigh,
    onSurface: readable(hex(scheme.onSurface), surfaces, direction, TEXT),
    onSurfaceVariant: readable(hex(scheme.onSurfaceVariant), surfaces, direction, TEXT),
  };
}
