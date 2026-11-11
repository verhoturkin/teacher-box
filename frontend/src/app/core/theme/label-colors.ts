import { LABEL_ROLES } from './generated-colors';
import { CORE_T } from '@core/i18n/texts';

/**
 * Colours of students and groups in the teacher's lists: a fixed palette of M3 static colours (formerly custom
 * colours). Each reference colour gives the four roles of an accent — the colour, on-colour, container and
 * on-container — of both themes from its M3 Fidelity scheme (2025 spec), so the container keeps the reference
 * colour like the portal colour does. The accent container highlights initials and group icons; photos keep
 * a colour ring. List rows retain the portal's neutral surfaces. Not harmonized with the portal colour: harmonizing pulls neighbouring hues
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

export function isLabelColor(value: unknown): value is LabelColor {
  return typeof value === 'string' && (LABEL_COLORS as readonly string[]).includes(value);
}

/**
 * The roles of a label colour: constants computed from the reference colours (`computed-colors.ts`) by
 * `npm run colors`, so the lists need no colour library (stage 376).
 */
export function labelRoles(label: LabelColor, dark: boolean): LabelRoles {
  return dark ? LABEL_ROLES[label].dark : LABEL_ROLES[label].light;
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

/** The tokens of both themes; static colours do not follow the portal colour. */
export const LABEL_TOKENS = { light: tokens(false), dark: tokens(true) } as const;
