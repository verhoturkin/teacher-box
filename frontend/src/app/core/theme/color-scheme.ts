import { AuraTokens } from './aura-base';
import { contrast, isHex } from './color';

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

/** What is computed from the seed of a portal color: the neutral palette and the roles of both themes. */
export interface SchemeRoles {
  readonly neutral: Shades;
  readonly light: Roles;
  readonly dark: Roles;
}

/** The whole scheme of a portal color: the primary and neutral palettes and the roles of both themes. */
export interface ColorScheme extends SchemeRoles {
  readonly primary: Shades;
}

/** A palette of Aura (the colors of the portal, red, green, amber) as `#rrggbb`. */
export function auraPalette(name: string): Shades {
  const primitive: unknown = AuraTokens.primitive;
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

export function shade(shades: Shades, name: string): string {
  const value = shades[name];
  if (value === undefined) {
    throw new Error(`No shade ${name}`);
  }
  return value;
}

/** The pairs of roles whose contrast the scheme keeps (text / background), for checks and tests. */
export function textPairs(roles: Roles): readonly (readonly [string, string, string])[] {
  const grounds: [string, string][] = [
    ['страница', roles.surfaceContainer],
    ['фон', roles.surface],
    ['карточка', roles.surfaceContainerLowest],
    ['плитка', roles.surfaceContainerLow],
    ['плитка тёмной темы', roles.surfaceContainerHigh],
    ['диалог', roles.surfaceContainerHigh],
    ['плитка в диалоге', roles.surfaceContainerLowest],
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
