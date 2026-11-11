/**
 * What `generated-colors.ts` must hold (stage 376): the colours that depend on constants only, computed
 * by the colour engine. `npm run colors` writes them down, `generated-colors.spec.ts` fails when they
 * differ. The app itself never imports this module — it would bring the colour library with it.
 */
import { CONTRASTS, SCHEMES } from './appearance';
import { colorScheme, computeLabelRoles } from './color-engine';
import { SchemeRoles, auraPalette } from './color-scheme';
import type { LabelColor, LabelRoles } from './label-colors';

/** The reference colours of the labels: Tailwind/Aura 500 (red 600), hues about 30° apart. */
const LABEL_REFERENCES: Readonly<Record<LabelColor, string>> = {
  RED: '#dc2626',
  ORANGE: '#f97316',
  YELLOW: '#eab308',
  LIME: '#84cc16',
  GREEN: '#10b981',
  CYAN: '#06b6d4',
  BLUE: '#3b82f6',
  VIOLET: '#8b5cf6',
  PURPLE: '#d946ef',
  PINK: '#ec4899',
};

/** Seeds whose schemes of every kind and contrast go into the stamp of the engine. */
const PROBES = ['#6366f1', '#bb2649', '#f5df4d', '#f0eee9'];

/** The roles of a label colour in both themes. */
export interface LabelThemes {
  readonly light: LabelRoles;
  readonly dark: LabelRoles;
}

export interface ComputedColors {
  /** The roles of the default colour (indigo) with the default appearance. */
  readonly DEFAULT_ROLES: SchemeRoles;
  readonly LABEL_ROLES: Readonly<Record<LabelColor, LabelThemes>>;
  /**
   * Changes whenever the engine gives another colour for anything it is asked here: roles kept on a
   * device under an older stamp are computed again.
   */
  readonly ENGINE_STAMP: string;
}

/** FNV-1a, 32 bits: enough to tell two outputs of the engine apart. */
function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    value = Math.imul(value ^ text.charCodeAt(index), 0x01000193);
  }
  return (value >>> 0).toString(16).padStart(8, '0');
}

function roles(seed: string, appearance?: Parameters<typeof colorScheme>[1]): SchemeRoles {
  const { neutral, light, dark } = colorScheme({ '500': seed }, appearance);
  return { neutral, light, dark };
}

export function computedColors(): ComputedColors {
  const { neutral, light, dark } = colorScheme(auraPalette('indigo'));
  const defaults: SchemeRoles = { neutral, light, dark };
  const themes = (label: LabelColor): LabelThemes => ({
    light: computeLabelRoles(LABEL_REFERENCES[label], false),
    dark: computeLabelRoles(LABEL_REFERENCES[label], true),
  });
  const labels: Record<LabelColor, LabelThemes> = {
    RED: themes('RED'),
    ORANGE: themes('ORANGE'),
    YELLOW: themes('YELLOW'),
    LIME: themes('LIME'),
    GREEN: themes('GREEN'),
    CYAN: themes('CYAN'),
    BLUE: themes('BLUE'),
    VIOLET: themes('VIOLET'),
    PURPLE: themes('PURPLE'),
    PINK: themes('PINK'),
  };
  const probes = PROBES.flatMap((seed) =>
    SCHEMES.flatMap((scheme) => CONTRASTS.map((contrast) => roles(seed, { scheme, contrast }))),
  );
  return {
    DEFAULT_ROLES: defaults,
    LABEL_ROLES: labels,
    ENGINE_STAMP: hash(JSON.stringify([defaults, labels, probes])),
  };
}
