/**
 * The scheme of any portal colour, computed here and now (ADR-0034). This module brings the colour
 * library with it: only lazy screens import it (the settings preview a colour live), the frame of the
 * app loads it with `import()` when the roles of the portal colour are not known yet
 * (`portal-accent.ts`, stage 376).
 */
import { Appearance, DEFAULT_APPEARANCE } from './appearance';
import { difference } from './color';
import { colorScheme } from './color-engine';
import { ColorScheme, lowestContrast } from './color-scheme';
import { accentShades } from './portal-accent';

/** Colors closer than this look alike (the difference in OKLab × 100, ADR-0023). */
const ALIKE = 12;

/**
 * The primary role differs from the chosen color this much or more: the teacher is told that the
 * color was made darker (lighter in the dark theme) to stay readable.
 */
const ADJUSTED = 10;

/** The scheme of a color of the portal (ADR-0023). */
export function accentScheme(
  accent: string,
  appearance: Appearance = DEFAULT_APPEARANCE,
): ColorScheme {
  return colorScheme(accentShades(accent), appearance);
}

/** A swatch of a color of the portal: the color itself and its readable mark (the check). */
export interface AccentSwatch {
  readonly background: string;
  readonly color: string;
}

/**
 * The swatch: the primary container of the light theme (Fidelity keeps the chosen color there)
 * and its on-color, ≥ 4.5:1 — white is short of 3:1 on teal and emerald.
 */
export function accentSwatch(accent: string): AccentSwatch {
  const { light } = accentScheme(accent);
  return { background: light.primaryContainer, color: light.onPrimaryContainer };
}

/** What the teacher should know about a color of the portal (the settings, ADR-0023). */
export interface AccentAdvice {
  /** The lowest contrast of a text of the portal in the light and the dark theme. */
  readonly light: number;
  readonly dark: number;
  /** Buttons and links are darker (or lighter) than the color itself, to stay readable. */
  readonly adjusted: boolean;
  /** The main buttons would look like the red deleting ones (there are no green buttons, ADR-0045). */
  readonly likeError: boolean;
}

export function accentAdvice(
  accent: string,
  appearance: Appearance = DEFAULT_APPEARANCE,
): AccentAdvice {
  const shades = accentShades(accent);
  const scheme = colorScheme(shades, appearance);
  const alike = (role: 'error'): boolean =>
    difference(scheme.light.primary, scheme.light[role]) < ALIKE ||
    difference(scheme.dark.primary, scheme.dark[role]) < ALIKE;
  return {
    light: lowestContrast(scheme.light),
    dark: lowestContrast(scheme.dark),
    adjusted:
      difference(scheme.light.primary, shades['600'] ?? scheme.light.primary) >= ADJUSTED ||
      difference(scheme.dark.primary, shades['200'] ?? scheme.dark.primary) >= ADJUSTED,
    likeError: alike('error'),
  };
}
