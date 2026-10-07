import Aura from '@primeuix/themes/aura';
import {
  ColorGroup,
  CustomColorGroup,
  DynamicScheme,
  Hct,
  SchemeFidelity,
  argbFromHex,
  customColor,
  hexFromArgb,
} from '@material/material-color-utilities';
import { contrast, isHex, readable, toOklch } from './color';

/** Shades 50–950 of a palette as `#rrggbb`. */
export type Shades = Readonly<Record<string, string>>;

export const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

/** The M3 roles of one scheme (ADR-0017, ADR-0019, ADR-0023). */
type RoleName =
  | 'primary'
  | 'onPrimary'
  | 'primaryContainer'
  | 'onPrimaryContainer'
  | 'secondary'
  | 'secondaryContainer'
  | 'onSecondaryContainer'
  | 'tertiary'
  | 'tertiaryContainer'
  | 'onTertiaryContainer'
  | 'error'
  | 'onError'
  | 'errorContainer'
  | 'onErrorContainer'
  | 'success'
  | 'onSuccess'
  | 'successContainer'
  | 'onSuccessContainer'
  | 'warning'
  | 'onWarning'
  | 'warningContainer'
  | 'onWarningContainer'
  | 'surface'
  | 'surfaceContainerLowest'
  | 'surfaceContainerLow'
  | 'surfaceContainer'
  | 'surfaceContainerHigh'
  | 'surfaceContainerHighest'
  | 'onSurface'
  | 'onSurfaceVariant'
  | 'outline'
  | 'outlineVariant'
  | 'inverseSurface'
  | 'inverseOnSurface'
  | 'inversePrimary'
  | 'scrim';

/** The roles of one scheme, every one a ready `#rrggbb`. */
export type Roles = Readonly<Record<RoleName, string>>;

/** The whole scheme of a portal color: the primary and neutral palettes and the roles of both themes. */
export interface ColorScheme {
  readonly primary: Shades;
  readonly neutral: Shades;
  readonly light: Roles;
  readonly dark: Roles;
}

/** A palette of Aura (the colors of the portal, red, green, amber) as `#rrggbb`. */
export function auraPalette(name: string): Shades {
  const primitive: unknown = Aura.primitive;
  const palette: unknown =
    typeof primitive === 'object' && primitive !== null
      ? Object.entries(primitive).find(([key]) => key === name)?.[1]
      : undefined;
  if (typeof palette !== 'object' || palette === null) {
    throw new Error(`No palette ${name}`);
  }
  const entries = Object.entries(palette).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && isHex(entry[1]),
  );
  return Object.fromEntries(entries);
}

function shade(shades: Shades, name: string): string {
  const value = shades[name];
  if (value === undefined) {
    throw new Error(`No shade ${name}`);
  }
  return value;
}

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
export function colorScheme(primary: Shades): ColorScheme {
  const seed = argbFromHex(shade(primary, '500'));
  const source = Hct.fromInt(seed);
  const light = new SchemeFidelity(source, false, 0, '2025');
  const dark = new SchemeFidelity(source, true, 0, '2025');
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

/** The pairs of roles whose contrast the scheme keeps (text / background), for checks and tests. */
export function textPairs(roles: Roles): readonly (readonly [string, string, string])[] {
  const grounds: [string, string][] = [
    ['страница', roles.surfaceContainer],
    ['фон', roles.surface],
    ['карточка', roles.surfaceContainerLowest],
    ['плитка', roles.surfaceContainerLow],
    ['плитка тёмной темы', roles.surfaceContainerHigh],
  ];
  const pairs: [string, string, string][] = [
    ['текст кнопки', roles.onPrimary, roles.primary],
    ['текст «Ближайшего занятия»', roles.onPrimaryContainer, roles.primaryContainer],
    ['тональная кнопка', roles.onSecondaryContainer, roles.secondaryContainer],
    ['выбранный пункт', roles.onTertiaryContainer, roles.tertiaryContainer],
    ['красная кнопка', roles.onError, roles.error],
    ['зелёная кнопка', roles.onSuccess, roles.success],
    ['предупреждение', roles.onWarningContainer, roles.warningContainer],
    ['ошибка', roles.onErrorContainer, roles.errorContainer],
    ['успех', roles.onSuccessContainer, roles.successContainer],
    ['сообщение', roles.inverseOnSurface, roles.inverseSurface],
    ['действие сообщения', roles.inversePrimary, roles.inverseSurface],
  ];
  for (const [name, ground] of grounds) {
    pairs.push(
      [`ссылка — ${name}`, roles.primary, ground],
      [`красный текст — ${name}`, roles.error, ground],
      [`зелёный текст — ${name}`, roles.success, ground],
      [`пояснение — ${name}`, roles.onSurfaceVariant, ground],
    );
  }
  return pairs;
}

/** The lowest contrast of the scheme's text pairs. */
export function lowestContrast(roles: Roles): number {
  return Math.min(...textPairs(roles).map(([, text, ground]) => contrast(text, ground)));
}
