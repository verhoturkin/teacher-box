import { Hct, SchemeFidelity, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { readable, toOklch } from './color';
import { CORE_T } from '@core/i18n/texts';

/**
 * Colours of students and groups in the teacher's lists: a fixed palette of M3 static colours (formerly custom
 * colours). Each reference colour gives the four roles of an accent — the colour, on-colour, container and
 * on-container — of both themes from its M3 Fidelity scheme (2025 spec), so the container keeps the reference
 * colour like the portal colour does. The same scheme gives the surface containers and the text on them: a row
 * of a student or a group is built like any row of the portal, only from the neutral palette of its colour. Not harmonized with the portal colour: harmonizing pulls neighbouring hues
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
  readonly surfaceContainerLowest: string;
  readonly surfaceContainerLow: string;
  readonly surfaceContainerHigh: string;
  readonly onSurface: string;
  readonly onSurfaceVariant: string;
}

/** Text is readable from this contrast on (WCAG 2.2, 1.4.3). */
const TEXT = 4.5;

export function isLabelColor(value: unknown): value is LabelColor {
  return typeof value === 'string' && (LABEL_COLORS as readonly string[]).includes(value);
}

/**
 * The roles of a label colour; an on-role short of 4.5:1 is moved along its hue (ADR-0023), the text of the
 * surfaces — away from every surface a row takes, as the portal's text roles are.
 */
export function labelRoles(label: LabelColor, dark: boolean): LabelRoles {
  const scheme = new SchemeFidelity(Hct.fromInt(argbFromHex(REFERENCES[label])), dark, 0, '2025');
  const hex = (argb: number): string => hexFromArgb(argb).toLowerCase();
  const color = hex(scheme.primary);
  const container = hex(scheme.primaryContainer);
  const on = (text: string, ground: string): string =>
    readable(text, [ground], toOklch(text).l >= toOklch(ground).l ? 'lighter' : 'darker', TEXT);
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
 * `labelRedContainer`, `onLabelRedContainer`, `labelRedSurfaceContainerLow`, `onLabelRedSurface`… →
 * `--p-md-label-red`, `--p-md-on-label-red-container`, `--p-md-label-red-surface-container-low`…
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
        [`label${name}SurfaceContainerLowest`, roles.surfaceContainerLowest],
        [`label${name}SurfaceContainerLow`, roles.surfaceContainerLow],
        [`label${name}SurfaceContainerHigh`, roles.surfaceContainerHigh],
        [`onLabel${name}Surface`, roles.onSurface],
        [`onLabel${name}SurfaceVariant`, roles.onSurfaceVariant],
      ];
    }),
  );
}

/** The tokens of both themes; static colours do not follow the portal colour, so they are computed once. */
export const LABEL_TOKENS = { light: tokens(false), dark: tokens(true) } as const;
