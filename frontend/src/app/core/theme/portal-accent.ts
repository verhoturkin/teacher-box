import { palette, updatePreset, updatePrimaryPalette } from '@primeuix/themes';
import { difference } from './color';
import {
  ColorScheme,
  SHADES,
  Shades,
  auraPalette,
  colorScheme,
  lowestContrast,
} from './color-scheme';
import { schemeTokens } from './teacher-box-preset';

/**
 * Colors of the portal (ADR-0015, ADR-0023): PrimeNG palettes or the teacher's own color `#rrggbb`
 * whose shades are built here. The roles are tones with the contrast 4.5:1 in both themes.
 */
export const ACCENTS = [
  { value: 'indigo', label: 'Индиго' },
  { value: 'blue', label: 'Синий' },
  { value: 'teal', label: 'Бирюзовый' },
  { value: 'emerald', label: 'Изумрудный' },
  { value: 'violet', label: 'Фиолетовый' },
  { value: 'pink', label: 'Розовый' },
] as const;

export type Accent = (typeof ACCENTS)[number]['value'];

export const DEFAULT_ACCENT: Accent = 'indigo';

/** The own color offered first: a calm dark green. */
export const DEFAULT_OWN_COLOR = '#0f766e';

/** Text is readable from this contrast on (WCAG 2.2, 1.4.3: text of normal size). */
export const MIN_CONTRAST = 4.5;

/** Colors closer than this look alike (the difference in OKLab × 100, ADR-0023). */
export const ALIKE = 12;

/**
 * The primary role differs from the chosen color this much or more: the teacher is told that the
 * color was made darker (lighter in the dark theme) to stay readable.
 */
const ADJUSTED = 10;

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

/** The scheme of a color of the portal (ADR-0023). */
export function accentScheme(accent: string): ColorScheme {
  return colorScheme(accentShades(accent));
}

/**
 * Paints the portal in its color: the roles of both themes are computed here and handed to the
 * theme as ready colors (ADR-0023).
 *
 * @return the scheme now in use
 */
export function applyAccent(accent: string): ColorScheme {
  const scheme = accentScheme(accent);
  // the palette first: it also sets up the theme with its options if there is none yet (tests)
  updatePrimaryPalette(scheme.primary);
  updatePreset({ semantic: schemeTokens(scheme) });
  return scheme;
}

/** What the teacher should know about a color of the portal (the settings, ADR-0023). */
export interface AccentAdvice {
  /** The lowest contrast of a text of the portal in the light and the dark theme. */
  readonly light: number;
  readonly dark: number;
  /** Buttons and links are darker (or lighter) than the color itself, to stay readable. */
  readonly adjusted: boolean;
  /** The main buttons would look like the green confirming ones. */
  readonly likeSuccess: boolean;
  /** The main buttons would look like the red cancelling and deleting ones. */
  readonly likeError: boolean;
}

export function accentAdvice(accent: string): AccentAdvice {
  const shades = accentShades(accent);
  const scheme = colorScheme(shades);
  const alike = (role: 'success' | 'error'): boolean =>
    difference(scheme.light.primary, scheme.light[role]) < ALIKE ||
    difference(scheme.dark.primary, scheme.dark[role]) < ALIKE;
  return {
    light: lowestContrast(scheme.light),
    dark: lowestContrast(scheme.dark),
    adjusted:
      difference(scheme.light.primary, shades['600'] ?? scheme.light.primary) >= ADJUSTED ||
      difference(scheme.dark.primary, shades['200'] ?? scheme.dark.primary) >= ADJUSTED,
    likeSuccess: alike('success'),
    likeError: alike('error'),
  };
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
