import { palette, updatePreset, updatePrimaryPalette } from '@primeuix/themes';
import { ColorScheme, SHADES, SchemeRoles, Shades, auraPalette, shade } from './color-scheme';
import { DEFAULT_ROLES, ENGINE_STAMP } from './generated-colors';
import { readDeviceSetting, writeDeviceSetting } from '@shared/storage/device-settings';
import { CORE_T } from '@core/i18n/texts';
import { schemeTokens } from './teacher-box-preset';
import { Appearance, DEFAULT_APPEARANCE } from './appearance';

/**
 * Colors of the portal (ADR-0015, ADR-0023): PrimeNG palettes or the teacher's own color `#rrggbb`
 * whose shades are built here. The roles are tones with the contrast 4.5:1 in both themes.
 */
export const ACCENTS = [
  { value: 'indigo', label: CORE_T.accents.indigo },
  { value: 'blue', label: CORE_T.accents.blue },
  { value: 'teal', label: CORE_T.accents.teal },
  { value: 'emerald', label: CORE_T.accents.emerald },
  { value: 'violet', label: CORE_T.accents.violet },
  { value: 'pink', label: CORE_T.accents.pink },
] as const;

export type Accent = (typeof ACCENTS)[number]['value'];

export const DEFAULT_ACCENT: Accent = 'indigo';

/** The own color offered first: a calm dark green. */
export const DEFAULT_OWN_COLOR = '#0f766e';

/** Text is readable from this contrast on (WCAG 2.2, 1.4.3: text of normal size). */
export const MIN_CONTRAST = 4.5;

const OWN_COLOR = /^#[0-9a-f]{6}$/i;

export function isAccent(value: string): value is Accent {
  return ACCENTS.some((accent) => accent.value === value);
}

/** `#rrggbb`: the teacher's own color. */
export function isOwnColor(value: string): boolean {
  return OWN_COLOR.test(value);
}

/** The shades 50–950 of a color of the portal as `#rrggbb`; an unknown color is the default. */
export function accentShades(accent: string): Shades {
  if (isOwnColor(accent)) {
    return ownShades(accent);
  }
  return auraPalette(isAccent(accent) ? accent : DEFAULT_ACCENT);
}

/** Device setting with the roles computed for the portal color (stage 376). */
export const SCHEME_KEY = 'tb.scheme';

/**
 * What the roles of a portal color are computed from: the stamp of the engine and the layout of the
 * setting (`1`), the seed, the custom colors success and warning, the scheme and the contrast. Roles
 * kept under another key are not used.
 */
function schemeKey(primary: Shades, appearance: Appearance): string {
  return [
    '1',
    ENGINE_STAMP,
    shade(primary, '500'),
    shade(auraPalette('green'), '500'),
    shade(auraPalette('amber'), '500'),
    appearance.scheme,
    appearance.contrast,
  ].join('|');
}

const DEFAULT_KEY = schemeKey(auraPalette(DEFAULT_ACCENT), DEFAULT_APPEARANCE);

/** `value` has every color of `sample` (roles or shades). */
function hasColors<T extends object>(value: unknown, sample: T): value is T {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.keys(sample).every((name) => {
      const color: unknown = Object.entries(value).find(([key]) => key === name)?.[1];
      return typeof color === 'string' && color !== '';
    })
  );
}

function storedRoles(key: string): SchemeRoles | null {
  try {
    const stored: unknown = JSON.parse(readDeviceSetting(SCHEME_KEY) ?? 'null');
    if (typeof stored !== 'object' || stored === null || !('key' in stored) || stored.key !== key) {
      return null;
    }
    const neutral: unknown = 'neutral' in stored ? stored.neutral : null;
    const light: unknown = 'light' in stored ? stored.light : null;
    const dark: unknown = 'dark' in stored ? stored.dark : null;
    return hasColors(neutral, DEFAULT_ROLES.neutral) &&
      hasColors(light, DEFAULT_ROLES.light) &&
      hasColors(dark, DEFAULT_ROLES.dark)
      ? { neutral, light, dark }
      : null;
  } catch {
    return null;
  }
}

/**
 * The scheme of a color of the portal when it is known without computing (stage 376): the default
 * color with the default appearance is a generated constant, any other one is kept on this device
 * once it has been computed. `null`: it has to be computed (`loadAccentScheme`).
 */
export function knownAccentScheme(
  accent: string,
  appearance: Appearance = DEFAULT_APPEARANCE,
): ColorScheme | null {
  const primary = accentShades(accent);
  const key = schemeKey(primary, appearance);
  const roles = key === DEFAULT_KEY ? DEFAULT_ROLES : storedRoles(key);
  return roles === null ? null : { primary, ...roles };
}

/**
 * The scheme of a color of the portal: the known one or, the first time on this device, computed by
 * the color library, which is loaded for that only, and kept for the next start.
 */
export async function loadAccentScheme(
  accent: string,
  appearance: Appearance = DEFAULT_APPEARANCE,
): Promise<ColorScheme> {
  const known = knownAccentScheme(accent, appearance);
  if (known !== null) {
    return known;
  }
  const { accentScheme } = await import('./accent-scheme');
  const scheme = accentScheme(accent, appearance);
  const { neutral, light, dark } = scheme;
  writeDeviceSetting(
    SCHEME_KEY,
    JSON.stringify({ key: schemeKey(scheme.primary, appearance), neutral, light, dark }),
  );
  return scheme;
}

/** Paints the portal in a scheme: its roles are handed to the theme as ready colors (ADR-0023). */
export function applyScheme(scheme: ColorScheme): void {
  // the palette first: it also sets up the theme with its options if there is none yet (tests)
  updatePrimaryPalette(scheme.primary);
  updatePreset({ semantic: schemeTokens(scheme) });
}

/** Shades 50–950 of the own color (the color itself is 500). */
export function ownShades(color: string): Shades {
  const scale: unknown = palette(color.toLowerCase());
  if (typeof scale !== 'object' || scale === null) {
    return auraPalette(DEFAULT_ACCENT);
  }
  const shades = Object.fromEntries(
    Object.entries(scale).filter(
      (entry): entry is [string, string] =>
        SHADES.includes(entry[0]) && typeof entry[1] === 'string' && OWN_COLOR.test(entry[1]),
    ),
  );
  return Object.keys(shades).length === SHADES.length ? shades : auraPalette(DEFAULT_ACCENT);
}
