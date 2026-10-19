import { Hct, SchemeFidelity, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { readable, toOklch } from './color';
import { CORE_T } from '@core/i18n/texts';

/**
 * Colours of students and groups in the teacher's lists: a fixed palette of M3 static colours (formerly custom
 * colours). Each reference colour gives the four roles of an accent — the colour, on-colour, container and
 * on-container — of both themes from its M3 Fidelity scheme (2025 spec), so the container keeps the reference
 * colour like the portal colour does. Not harmonized with the portal colour: harmonizing pulls neighbouring hues
 * together, and the labels must stay apart (our decision).
 */
export const LABEL_COLORS = [
  'RED',
  'ORANGE',
  'YELLOW',
  'LIME',
  'GREEN',
  'CYAN',
  'BLUE',
  'VIOLET',
  'PURPLE',
  'PINK',
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

/** The reference colours: Tailwind/Aura 500 (red 600), hues about 30° apart. */
const REFERENCES: Readonly<Record<LabelColor, string>> = {
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

/** The four roles of a label colour in one theme, every one `#rrggbb`. */
export interface LabelRoles {
  readonly color: string;
  readonly onColor: string;
  readonly container: string;
  readonly onContainer: string;
}

/** Text is readable from this contrast on (WCAG 2.2, 1.4.3). */
const TEXT = 4.5;

export function isLabelColor(value: unknown): value is LabelColor {
  return typeof value === 'string' && (LABEL_COLORS as readonly string[]).includes(value);
}

/** The roles of a label colour; an on-role short of 4.5:1 is moved along its hue (ADR-0023). */
export function labelRoles(label: LabelColor, dark: boolean): LabelRoles {
  const scheme = new SchemeFidelity(Hct.fromInt(argbFromHex(REFERENCES[label])), dark, 0, '2025');
  const hex = (argb: number): string => hexFromArgb(argb).toLowerCase();
  const color = hex(scheme.primary);
  const container = hex(scheme.primaryContainer);
  const on = (text: string, ground: string): string =>
    readable(text, [ground], toOklch(text).l >= toOklch(ground).l ? 'lighter' : 'darker', TEXT);
  return {
    color,
    onColor: on(hex(scheme.onPrimary), color),
    container,
    onContainer: on(hex(scheme.onPrimaryContainer), container),
  };
}

/** The colour's name in the interface. */
export function labelName(label: LabelColor): string {
  return CORE_T.labelColors[label];
}

/** The CSS name of a label colour: `--p-md-label-<name>…`, `data-tb-label="<name>"`. */
export function labelKey(label: LabelColor): string {
  return label.toLowerCase();
}

/**
 * The roles of every label colour of one theme as tokens of the `md` scheme: `labelRed`, `onLabelRed`,
 * `labelRedContainer`, `onLabelRedContainer` → `--p-md-label-red`, `--p-md-on-label-red-container`…
 */
function tokens(dark: boolean): Readonly<Record<string, string>> {
  return Object.fromEntries(
    LABEL_COLORS.flatMap((label) => {
      const name = label.charAt(0) + label.slice(1).toLowerCase();
      const roles = labelRoles(label, dark);
      return [
        [`label${name}`, roles.color],
        [`onLabel${name}`, roles.onColor],
        [`label${name}Container`, roles.container],
        [`onLabel${name}Container`, roles.onContainer],
      ];
    }),
  );
}

/** The tokens of both themes; static colours do not follow the portal colour, so they are computed once. */
export const LABEL_TOKENS = { light: tokens(false), dark: tokens(true) } as const;
