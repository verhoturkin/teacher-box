import { palette, updatePrimaryPalette } from '@primeuix/themes';

/**
 * Colors of the portal (ADR-0015): PrimeNG palettes that keep contrast in both themes, or the
 * teacher's own color `#rrggbb` whose shades are built here.
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

/** Contrast of the text on buttons below this is poorly readable (WCAG 2.2 for large text and UI). */
export const MIN_CONTRAST = 3;

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const OWN_COLOR = /^#[0-9a-f]{6}$/i;
/**
 * The roles of a filled button (ADR-0017): in the light theme white text on the shade 600, in the
 * dark one the shade 900 on the shade 200.
 */
const LIGHT_BUTTON_TEXT = '#ffffff';

export function isAccent(value: string): value is Accent {
  return ACCENTS.some((accent) => accent.value === value);
}

/** `#rrggbb`: the teacher's own color. */
export function isOwnColor(value: string): boolean {
  return OWN_COLOR.test(value);
}

/**
 * Paints buttons, links and highlights in the color of the portal; an unknown color is the default.
 *
 * @return the primary palette now in use, e.g. `{ 500: '{emerald.500}', ... }` or `{ 500: '#0f766e', ... }`
 */
export function applyAccent(accent: string): Record<string, string> {
  const shades = isOwnColor(accent) ? ownShades(accent) : namedShades(accent);
  updatePrimaryPalette(shades);
  return shades;
}

/** How readable the text on buttons of the own color is in the light and the dark theme. */
export function ownColorContrast(color: string): { readonly light: number; readonly dark: number } {
  const shades = ownShades(color);
  return {
    light: contrast(LIGHT_BUTTON_TEXT, shades['600'] ?? color),
    dark: contrast(shades['900'] ?? color, shades['200'] ?? color),
  };
}

/**
 * Whether the color of the portal looks like the green of confirming buttons (ADR-0019): the
 * emerald palette or an own color of a green hue (75–165°) that is not greyish.
 */
export function isGreenAccent(accent: string): boolean {
  if (accent === 'emerald') {
    return true;
  }
  if (!isOwnColor(accent)) {
    return false;
  }
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map(
    (start) => parseInt(accent.slice(start, start + 2), 16) / 255,
  );
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const chroma = max - min;
  const saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1));
  if (max !== green || saturation < 0.25) {
    return false;
  }
  const hue = 60 * ((blue - red) / chroma + 2);
  return hue >= 75 && hue <= 165;
}

/** Shades 50–950 of the own color (the color itself is 500). */
export function ownShades(color: string): Record<string, string> {
  const scale: unknown = palette(color.toLowerCase());
  if (typeof scale !== 'object' || scale === null) {
    return namedShades(DEFAULT_ACCENT);
  }
  const shades = Object.fromEntries(
    Object.entries(scale).filter(
      (entry): entry is [string, string] =>
        SHADES.includes(Number(entry[0])) && typeof entry[1] === 'string',
    ),
  );
  return Object.keys(shades).length === SHADES.length ? shades : namedShades(DEFAULT_ACCENT);
}

function namedShades(accent: string): Record<string, string> {
  const name = isAccent(accent) ? accent : DEFAULT_ACCENT;
  return Object.fromEntries(SHADES.map((shade) => [String(shade), `{${name}.${String(shade)}}`]));
}

/** WCAG contrast ratio of two `#rrggbb` colors, from 1 to 21. */
export function contrast(first: string, second: string): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

function luminance(color: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(color.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
