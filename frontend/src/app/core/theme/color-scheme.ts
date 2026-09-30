import Aura from '@primeuix/themes/aura';
import { Oklch, contrast, isHex, readable, toHex, toOklch } from './color';

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

/** A tone of the seed's hue: lightness and chroma fixed (ADR-0017), tertiary 60° further. */
function toneOf(seed: Oklch): (lightness: number, chroma: number, hueShift?: number) => string {
  return (lightness, chroma, hueShift = 0) =>
    toHex({ l: lightness, c: chroma, h: (seed.h + hueShift) % 360 });
}

const WHITE = '#ffffff';

/**
 * The scheme of a portal color from its shades 50–950 (ADR-0023). The tones are those of ADR-0017
 * and ADR-0019; the text colors are then made readable: primary, error, success and warning have the
 * contrast 4.5:1 to every surface they stand on (the page, cards, tiles, the hero card) and to the
 * text on them, as the tone 40 of M3 does.
 */
export function colorScheme(primary: Shades): ColorScheme {
  const tone = toneOf(toOklch(shade(primary, '500')));
  const neutral: Shades = {
    '0': tone(0.995, 0.002),
    '50': tone(0.978, 0.006),
    '100': tone(0.955, 0.009),
    '200': tone(0.925, 0.011),
    '300': tone(0.87, 0.013),
    '400': tone(0.71, 0.016),
    '500': tone(0.56, 0.018),
    '600': tone(0.46, 0.018),
    '700': tone(0.37, 0.016),
    '800': tone(0.28, 0.013),
    '900': tone(0.215, 0.01),
    '950': tone(0.16, 0.008),
  };
  const n = (name: string): string => shade(neutral, name);
  const p = (name: string): string => shade(primary, name);
  const red = auraPalette('red');
  const green = auraPalette('green');
  const amber = auraPalette('amber');
  const c = (palette: Shades, name: string): string => shade(palette, name);

  const lightSurfaces = {
    surface: n('50'),
    surfaceContainerLowest: n('0'),
    surfaceContainerLow: tone(0.965, 0.007),
    surfaceContainer: n('100'),
    surfaceContainerHigh: tone(0.94, 0.01),
    surfaceContainerHighest: n('200'),
  };
  // the hero card (primary container) keeps a strong contrast to its text: 7:1, like tones 90 / 10
  const lightPrimaryContainer = readable(p('100'), [p('900')], 'lighter', 7);
  // text stands on the page, cards, tiles and the hero card (the primary container)
  const lightGrounds = [...Object.values(lightSurfaces), lightPrimaryContainer];
  const lightOnPrimaryContainer = readable(p('900'), [lightPrimaryContainer], 'darker');
  const light: Roles = {
    primary: readable(p('600'), [WHITE, ...lightGrounds], 'darker'),
    onPrimary: WHITE,
    primaryContainer: lightPrimaryContainer,
    onPrimaryContainer: lightOnPrimaryContainer,
    secondary: readable(tone(0.48, 0.04), lightGrounds, 'darker'),
    secondaryContainer: tone(0.91, 0.05),
    onSecondaryContainer: readable(tone(0.28, 0.05), [tone(0.91, 0.05)], 'darker'),
    tertiary: readable(tone(0.48, 0.09, 60), lightGrounds, 'darker'),
    tertiaryContainer: tone(0.915, 0.06, 60),
    onTertiaryContainer: readable(tone(0.3, 0.06, 60), [tone(0.915, 0.06, 60)], 'darker'),
    error: readable(c(red, '700'), [WHITE, ...lightGrounds], 'darker'),
    onError: WHITE,
    errorContainer: c(red, '100'),
    onErrorContainer: c(red, '900'),
    success: readable(c(green, '700'), [WHITE, ...lightGrounds], 'darker'),
    onSuccess: WHITE,
    successContainer: c(green, '100'),
    onSuccessContainer: c(green, '900'),
    warning: readable(c(amber, '700'), [WHITE, ...lightGrounds], 'darker'),
    onWarning: WHITE,
    warningContainer: c(amber, '100'),
    onWarningContainer: c(amber, '900'),
    ...lightSurfaces,
    onSurface: n('900'),
    onSurfaceVariant: readable(n('600'), lightGrounds, 'darker'),
    outline: n('500'),
    outlineVariant: n('300'),
    inverseSurface: n('800'),
    inverseOnSurface: n('100'),
    inversePrimary: readable(p('200'), [n('800')], 'lighter'),
    scrim: 'rgb(0 0 0 / 32%)',
  };

  const darkSurfaces = {
    surface: n('950'),
    surfaceContainerLowest: tone(0.13, 0.006),
    surfaceContainerLow: tone(0.19, 0.009),
    surfaceContainer: n('900'),
    surfaceContainerHigh: tone(0.25, 0.011),
    surfaceContainerHighest: n('800'),
  };
  const darkPrimaryContainer = readable(p('800'), [p('100')], 'darker', 7);
  const darkGrounds = [...Object.values(darkSurfaces), darkPrimaryContainer];
  const dark: Roles = {
    primary: readable(p('200'), [p('900'), ...darkGrounds], 'lighter'),
    onPrimary: p('900'),
    primaryContainer: darkPrimaryContainer,
    onPrimaryContainer: readable(p('100'), [darkPrimaryContainer], 'lighter'),
    secondary: readable(tone(0.82, 0.035), darkGrounds, 'lighter'),
    secondaryContainer: tone(0.35, 0.05),
    onSecondaryContainer: readable(tone(0.91, 0.035), [tone(0.35, 0.05)], 'lighter'),
    tertiary: readable(tone(0.82, 0.07, 60), darkGrounds, 'lighter'),
    tertiaryContainer: tone(0.37, 0.075, 60),
    onTertiaryContainer: readable(tone(0.92, 0.04, 60), [tone(0.37, 0.075, 60)], 'lighter'),
    error: readable(c(red, '300'), [c(red, '900'), ...darkGrounds], 'lighter'),
    onError: c(red, '900'),
    errorContainer: c(red, '800'),
    onErrorContainer: c(red, '100'),
    success: readable(c(green, '300'), [c(green, '950'), ...darkGrounds], 'lighter'),
    onSuccess: c(green, '950'),
    successContainer: c(green, '800'),
    onSuccessContainer: c(green, '100'),
    warning: readable(c(amber, '300'), [c(amber, '950'), ...darkGrounds], 'lighter'),
    onWarning: c(amber, '950'),
    warningContainer: c(amber, '800'),
    onWarningContainer: c(amber, '100'),
    ...darkSurfaces,
    onSurface: n('200'),
    onSurfaceVariant: readable(n('300'), darkGrounds, 'lighter'),
    outline: tone(0.62, 0.016),
    outlineVariant: n('700'),
    inverseSurface: n('200'),
    inverseOnSurface: n('800'),
    inversePrimary: readable(p('600'), [n('200')], 'darker'),
    scrim: 'rgb(0 0 0 / 32%)',
  };
  return { primary, neutral, light, dark };
}

/** The pairs of roles whose contrast the scheme keeps (text / background), for checks and tests. */
export function textPairs(roles: Roles): readonly (readonly [string, string, string])[] {
  const grounds: [string, string][] = [
    ['страница', roles.surfaceContainer],
    ['фон', roles.surface],
    ['карточка', roles.surfaceContainerLowest],
    ['плитка', roles.surfaceContainerLow],
    ['плитка тёмной темы', roles.surfaceContainerHigh],
    ['карточка «Ближайшее занятие»', roles.primaryContainer],
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
