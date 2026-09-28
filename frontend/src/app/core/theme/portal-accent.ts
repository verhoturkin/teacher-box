import { updatePrimaryPalette } from '@primeuix/themes';

/** Colors of the portal (ADR-0015): PrimeNG palettes that keep contrast in both themes. */
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

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export function isAccent(value: string): value is Accent {
  return ACCENTS.some((accent) => accent.value === value);
}

/**
 * Paints buttons, links and highlights in the color of the portal; an unknown color is the default.
 *
 * @return the primary palette now in use, e.g. `{ 500: '{emerald.500}', ... }`
 */
export function applyAccent(accent: string): Record<string, string> {
  const palette = isAccent(accent) ? accent : DEFAULT_ACCENT;
  const shades = Object.fromEntries(
    SHADES.map((shade) => [String(shade), `{${palette}.${String(shade)}}`]),
  );
  updatePrimaryPalette(shades);
  return shades;
}
