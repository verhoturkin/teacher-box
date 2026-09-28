import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Material Design 3 on top of Aura (ADR-0017).
 *
 * The color of the portal is the seed: its shades 50–950 (indigo by default, replaced by
 * `applyAccent`) give the primary roles, and the neutral, secondary and tertiary tones are derived
 * from its hue in the browser (`oklch(from ...)`), so the whole scheme follows the portal color.
 * The M3 roles are the tokens `md.*` (CSS variables `--p-md-*`); the PrimeNG tokens refer to them.
 */

/** A tone of the seed's hue: lightness and chroma fixed, the hue of the portal color. */
function tone(lightness: number, chroma: number, hueShift = 0): string {
  const hue = hueShift === 0 ? 'h' : `calc(h + ${String(hueShift)})`;
  return `oklch(from {primary.500} ${String(lightness)} ${String(chroma)} ${hue})`;
}

/** Content over a background: the M3 state layer (hover 8 %, pressed 12 %). */
function layer(content: string, background: string, percent: number): string {
  return `color-mix(in srgb, ${content} ${String(percent)}%, ${background})`;
}

/** Neutral tones with a hint of the portal color: surfaces, text and outlines of both schemes. */
const NEUTRAL = {
  0: tone(0.995, 0.002),
  50: tone(0.978, 0.006),
  100: tone(0.955, 0.009),
  200: tone(0.925, 0.011),
  300: tone(0.87, 0.013),
  400: tone(0.71, 0.016),
  500: tone(0.56, 0.018),
  600: tone(0.46, 0.018),
  700: tone(0.37, 0.016),
  800: tone(0.28, 0.013),
  900: tone(0.215, 0.01),
  950: tone(0.16, 0.008),
};

const LIGHT_ROLES = {
  primary: '{primary.600}',
  onPrimary: '#ffffff',
  primaryContainer: '{primary.100}',
  onPrimaryContainer: '{primary.900}',
  secondary: tone(0.48, 0.04),
  secondaryContainer: tone(0.915, 0.035),
  onSecondaryContainer: tone(0.28, 0.04),
  tertiary: tone(0.48, 0.09, 60),
  tertiaryContainer: tone(0.92, 0.045, 60),
  onTertiaryContainer: tone(0.3, 0.06, 60),
  error: '{red.600}',
  onError: '#ffffff',
  errorContainer: '{red.100}',
  onErrorContainer: '{red.900}',
  surface: '{surface.50}',
  surfaceContainerLowest: '{surface.0}',
  surfaceContainerLow: tone(0.965, 0.007),
  surfaceContainer: '{surface.100}',
  surfaceContainerHigh: tone(0.94, 0.01),
  surfaceContainerHighest: '{surface.200}',
  onSurface: '{surface.900}',
  onSurfaceVariant: '{surface.600}',
  outline: '{surface.500}',
  outlineVariant: '{surface.300}',
  inverseSurface: '{surface.800}',
  inverseOnSurface: '{surface.100}',
  inversePrimary: '{primary.200}',
  scrim: 'rgb(0 0 0 / 32%)',
};

const DARK_ROLES = {
  primary: '{primary.200}',
  onPrimary: '{primary.900}',
  primaryContainer: '{primary.800}',
  onPrimaryContainer: '{primary.100}',
  secondary: tone(0.82, 0.035),
  secondaryContainer: tone(0.35, 0.035),
  onSecondaryContainer: tone(0.91, 0.03),
  tertiary: tone(0.82, 0.07, 60),
  tertiaryContainer: tone(0.37, 0.06, 60),
  onTertiaryContainer: tone(0.92, 0.04, 60),
  error: '{red.300}',
  onError: '{red.900}',
  errorContainer: '{red.800}',
  onErrorContainer: '{red.100}',
  surface: '{surface.950}',
  surfaceContainerLowest: tone(0.13, 0.006),
  surfaceContainerLow: tone(0.19, 0.009),
  surfaceContainer: '{surface.900}',
  surfaceContainerHigh: tone(0.25, 0.011),
  surfaceContainerHighest: '{surface.800}',
  onSurface: '{surface.200}',
  onSurfaceVariant: '{surface.300}',
  outline: tone(0.62, 0.016),
  outlineVariant: '{surface.700}',
  inverseSurface: '{surface.200}',
  inverseOnSurface: '{surface.800}',
  inversePrimary: '{primary.600}',
  scrim: 'rgb(0 0 0 / 50%)',
};

/**
 * The PrimeNG meanings of the roles, the same in both schemes except the background of cards:
 * the page is a container and cards lie on it lighter (light: the lowest container on the
 * container, dark: the container on the surface).
 */
function scheme(card: string): Record<string, unknown> {
  return {
    surface: NEUTRAL,
    primary: {
      color: '{md.primary}',
      contrastColor: '{md.on.primary}',
      hoverColor: layer('{md.on.primary}', '{md.primary}', 8),
      activeColor: layer('{md.on.primary}', '{md.primary}', 12),
    },
    highlight: {
      background: '{md.secondary.container}',
      focusBackground: layer('{md.on.secondary.container}', '{md.secondary.container}', 12),
      color: '{md.on.secondary.container}',
      focusColor: '{md.on.secondary.container}',
    },
    mask: { background: '{md.scrim}', color: '{md.on.surface}' },
    formField: {
      background: 'transparent',
      disabledBackground: 'color-mix(in srgb, {md.on.surface} 4%, transparent)',
      filledBackground: '{md.surface.container.highest}',
      filledHoverBackground: layer('{md.on.surface}', '{md.surface.container.highest}', 8),
      filledFocusBackground: '{md.surface.container.highest}',
      borderColor: '{md.outline}',
      hoverBorderColor: '{md.on.surface}',
      focusBorderColor: '{md.primary}',
      invalidBorderColor: '{md.error}',
      color: '{md.on.surface}',
      disabledColor: 'color-mix(in srgb, {md.on.surface} 38%, transparent)',
      placeholderColor: '{md.on.surface.variant}',
      invalidPlaceholderColor: '{md.error}',
      floatLabelColor: '{md.on.surface.variant}',
      floatLabelFocusColor: '{md.primary}',
      floatLabelActiveColor: '{md.on.surface.variant}',
      floatLabelInvalidColor: '{md.error}',
      iconColor: '{md.on.surface.variant}',
      shadow: 'none',
    },
    text: {
      color: '{md.on.surface}',
      hoverColor: '{md.on.surface}',
      mutedColor: '{md.on.surface.variant}',
      hoverMutedColor: '{md.on.surface}',
    },
    content: {
      background: card,
      hoverBackground: layer('{md.on.surface}', card, 8),
      borderColor: '{md.outline.variant}',
      color: '{md.on.surface}',
      hoverColor: '{md.on.surface}',
    },
    overlay: {
      select: {
        background: '{md.surface.container}',
        borderColor: 'transparent',
        color: '{md.on.surface}',
      },
      popover: {
        background: '{md.surface.container}',
        borderColor: 'transparent',
        color: '{md.on.surface}',
      },
      modal: {
        background: '{md.surface.container.high}',
        borderColor: 'transparent',
        color: '{md.on.surface}',
      },
    },
    list: {
      option: {
        focusBackground: 'color-mix(in srgb, {md.on.surface} 8%, transparent)',
        selectedBackground: '{md.secondary.container}',
        selectedFocusBackground: layer(
          '{md.on.secondary.container}',
          '{md.secondary.container}',
          12,
        ),
        color: '{md.on.surface}',
        focusColor: '{md.on.surface}',
        selectedColor: '{md.on.secondary.container}',
        selectedFocusColor: '{md.on.secondary.container}',
        icon: { color: '{md.on.surface.variant}', focusColor: '{md.on.surface}' },
      },
      optionGroup: { background: 'transparent', color: '{md.on.surface.variant}' },
    },
    navigation: {
      item: {
        focusBackground: 'color-mix(in srgb, {md.on.surface} 8%, transparent)',
        activeBackground: 'color-mix(in srgb, {md.on.surface} 12%, transparent)',
        color: '{md.on.surface}',
        focusColor: '{md.on.surface}',
        activeColor: '{md.on.surface}',
        icon: {
          color: '{md.on.surface.variant}',
          focusColor: '{md.on.surface}',
          activeColor: '{md.on.surface}',
        },
      },
      submenuLabel: { background: 'transparent', color: '{md.on.surface.variant}' },
      submenuIcon: {
        color: '{md.on.surface.variant}',
        focusColor: '{md.on.surface}',
        activeColor: '{md.on.surface}',
      },
    },
  };
}

const ELEVATION_2 = '0 1px 2px rgb(0 0 0 / 30%), 0 2px 6px 2px rgb(0 0 0 / 15%)';
const ELEVATION_3 = '0 1px 3px rgb(0 0 0 / 30%), 0 4px 8px 3px rgb(0 0 0 / 15%)';
const PILL = '999px';

/** A state layer of the content color over a transparent background. */
function over(content: string, percent: number): string {
  return `color-mix(in srgb, ${content} ${String(percent)}%, transparent)`;
}

/** Filled, tonal, outlined and text buttons (M3) for PrimeNG's plain, secondary, outlined, text. */
const BUTTON_SCHEME = {
  root: {
    secondary: {
      background: '{md.secondary.container}',
      hoverBackground: layer('{md.on.secondary.container}', '{md.secondary.container}', 8),
      activeBackground: layer('{md.on.secondary.container}', '{md.secondary.container}', 12),
      borderColor: '{md.secondary.container}',
      hoverBorderColor: layer('{md.on.secondary.container}', '{md.secondary.container}', 8),
      activeBorderColor: layer('{md.on.secondary.container}', '{md.secondary.container}', 12),
      color: '{md.on.secondary.container}',
      hoverColor: '{md.on.secondary.container}',
      activeColor: '{md.on.secondary.container}',
      focusRing: { color: '{md.primary}', shadow: 'none' },
    },
    danger: {
      background: '{md.error}',
      hoverBackground: layer('{md.on.error}', '{md.error}', 8),
      activeBackground: layer('{md.on.error}', '{md.error}', 12),
      borderColor: '{md.error}',
      hoverBorderColor: layer('{md.on.error}', '{md.error}', 8),
      activeBorderColor: layer('{md.on.error}', '{md.error}', 12),
      color: '{md.on.error}',
      hoverColor: '{md.on.error}',
      activeColor: '{md.on.error}',
      focusRing: { color: '{md.error}', shadow: 'none' },
    },
  },
  outlined: {
    primary: {
      hoverBackground: over('{md.primary}', 8),
      activeBackground: over('{md.primary}', 12),
      borderColor: '{md.outline}',
      color: '{md.primary}',
    },
    secondary: {
      hoverBackground: over('{md.on.surface.variant}', 8),
      activeBackground: over('{md.on.surface.variant}', 12),
      borderColor: '{md.outline}',
      color: '{md.on.surface.variant}',
    },
    danger: {
      hoverBackground: over('{md.error}', 8),
      activeBackground: over('{md.error}', 12),
      borderColor: '{md.outline}',
      color: '{md.error}',
    },
  },
  text: {
    primary: {
      hoverBackground: over('{md.primary}', 8),
      activeBackground: over('{md.primary}', 12),
      color: '{md.primary}',
    },
    secondary: {
      hoverBackground: over('{md.on.surface.variant}', 8),
      activeBackground: over('{md.on.surface.variant}', 12),
      color: '{md.on.surface.variant}',
    },
    danger: {
      hoverBackground: over('{md.error}', 8),
      activeBackground: over('{md.error}', 12),
      color: '{md.error}',
    },
  },
  link: { color: '{md.primary}', hoverColor: '{md.primary}', activeColor: '{md.primary}' },
};

/** Snackbar: every severity on the inverse surface. */
function snackbar(): Record<string, unknown> {
  const severity = {
    background: '{md.inverse.surface}',
    borderColor: 'transparent',
    color: '{md.inverse.on.surface}',
    detailColor: '{md.inverse.on.surface}',
    shadow: ELEVATION_3,
    closeButton: {
      hoverBackground: over('{md.inverse.on.surface}', 8),
      focusRing: { color: '{md.inverse.primary}', shadow: 'none' },
    },
  };
  return {
    root: { blur: '0' },
    info: severity,
    success: severity,
    warn: severity,
    error: severity,
    secondary: severity,
    contrast: severity,
  };
}

/** Chips of statuses: the containers of the roles. */
const TAG_SCHEME = {
  primary: { background: '{md.primary.container}', color: '{md.on.primary.container}' },
  secondary: { background: '{md.secondary.container}', color: '{md.on.secondary.container}' },
  danger: { background: '{md.error.container}', color: '{md.on.error.container}' },
};

const TOGGLE_SCHEME = {
  root: {
    background: 'transparent',
    checkedBackground: '{md.secondary.container}',
    hoverBackground: over('{md.on.surface}', 8),
    borderColor: '{md.outline}',
    color: '{md.on.surface}',
    hoverColor: '{md.on.surface}',
    checkedColor: '{md.on.secondary.container}',
    checkedBorderColor: '{md.outline}',
  },
  content: { checkedBackground: 'transparent' },
  icon: {
    color: '{md.on.surface}',
    hoverColor: '{md.on.surface}',
    checkedColor: '{md.on.secondary.container}',
  },
};

const SWITCH_SCHEME = {
  root: {
    background: '{md.surface.container.highest}',
    hoverBackground: '{md.surface.container.highest}',
    checkedBackground: '{md.primary}',
    checkedHoverBackground: '{md.primary}',
  },
  handle: {
    background: '{md.outline}',
    hoverBackground: '{md.on.surface.variant}',
    checkedBackground: '{md.on.primary}',
    checkedHoverBackground: '{md.primary.container}',
    color: '{md.surface.container.highest}',
    hoverColor: '{md.surface.container.highest}',
    checkedColor: '{md.on.primary.container}',
    checkedHoverColor: '{md.on.primary.container}',
  },
};

export const TeacherBoxPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '16px',
      xl: '28px',
    },
  },
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{md.primary}',
      offset: '2px',
      shadow: 'none',
    },
    disabledOpacity: '0.38',
    formField: {
      paddingX: '1rem',
      paddingY: '0.6875rem',
      sm: { fontSize: '0.875rem', paddingX: '0.75rem', paddingY: '0.375rem' },
      lg: { fontSize: '1.125rem', paddingX: '1rem', paddingY: '0.875rem' },
      borderRadius: '{border.radius.xs}',
      focusRing: {
        width: '1px',
        style: 'solid',
        color: '{md.primary}',
        offset: '-2px',
        shadow: 'none',
      },
    },
    list: {
      padding: '0.5rem 0',
      gap: '0',
      header: { padding: '0.75rem 1rem 0.5rem' },
      option: { padding: '0.75rem 1rem', borderRadius: '0' },
      optionGroup: { padding: '0.75rem 1rem 0.5rem', fontWeight: '500' },
    },
    content: { borderRadius: '{border.radius.md}' },
    navigation: {
      list: { padding: '0.5rem 0', gap: '0' },
      item: { padding: '0.75rem 1rem', borderRadius: '0', gap: '0.75rem' },
      submenuLabel: { padding: '0.75rem 1rem 0.5rem', fontWeight: '500' },
    },
    overlay: {
      select: { borderRadius: '{border.radius.xs}', shadow: ELEVATION_2 },
      popover: { borderRadius: '{border.radius.md}', padding: '1rem', shadow: ELEVATION_2 },
      modal: { borderRadius: '{border.radius.xl}', padding: '1.5rem', shadow: ELEVATION_3 },
      navigation: { shadow: ELEVATION_2 },
    },
    colorScheme: {
      light: { ...scheme('{md.surface.container.lowest}'), md: LIGHT_ROLES },
      dark: { ...scheme('{md.surface.container}'), md: DARK_ROLES },
    },
  },
  components: {
    button: {
      root: {
        borderRadius: PILL,
        roundedBorderRadius: PILL,
        gap: '0.5rem',
        paddingX: '1.5rem',
        paddingY: '0.625rem',
        iconOnlyWidth: '2.5rem',
        sm: {
          fontSize: '0.8125rem',
          paddingX: '1rem',
          paddingY: '0.375rem',
          iconOnlyWidth: '2rem',
        },
        lg: {
          fontSize: '1rem',
          paddingX: '1.75rem',
          paddingY: '0.875rem',
          iconOnlyWidth: '3.5rem',
        },
        label: { fontWeight: '500' },
        raisedShadow: '0 1px 2px rgb(0 0 0 / 30%), 0 1px 3px 1px rgb(0 0 0 / 15%)',
      },
      colorScheme: { light: BUTTON_SCHEME, dark: BUTTON_SCHEME },
    },
    card: {
      root: {
        background: '{content.background}',
        borderRadius: '{border.radius.lg}',
        shadow: 'none',
      },
      body: { padding: '1.25rem 1.5rem', gap: '0.75rem' },
      title: { fontSize: '1.375rem', fontWeight: '400' },
      subtitle: { color: '{md.on.surface.variant}' },
    },
    dialog: {
      root: { background: '{overlay.modal.background}', borderColor: 'transparent' },
      header: { padding: '1.5rem 1.5rem 1rem', gap: '0.5rem' },
      title: { fontSize: '1.5rem', fontWeight: '400' },
      content: { padding: '0 1.5rem' },
      footer: { padding: '1.5rem', gap: '0.5rem' },
    },
    drawer: {
      root: { background: '{md.surface.container.low}', borderColor: 'transparent' },
      title: { fontSize: '1.375rem', fontWeight: '400' },
    },
    menu: {
      root: {
        background: '{md.surface.container}',
        borderColor: 'transparent',
        borderRadius: '{border.radius.xs}',
        shadow: ELEVATION_2,
      },
      list: { padding: '0.5rem 0', gap: '0' },
      item: { padding: '0.75rem 1rem', borderRadius: '0', gap: '0.75rem' },
      separator: { borderColor: '{md.outline.variant}' },
    },
    tabs: {
      tablist: {
        background: 'transparent',
        borderColor: '{md.surface.container.highest}',
      },
      tab: {
        background: 'transparent',
        hoverBackground: over('{md.on.surface}', 8),
        activeBackground: 'transparent',
        color: '{md.on.surface.variant}',
        hoverColor: '{md.on.surface}',
        activeColor: '{md.primary}',
        padding: '0.875rem 1rem',
        fontWeight: '500',
      },
      tabpanel: {
        background: 'transparent',
        padding: '1rem 0 0 0',
      },
      navButton: {
        background: 'transparent',
      },
      activeBar: {
        height: '3px',
        bottom: '-1px',
        background: '{md.primary}',
      },
      colorScheme: {
        light: { navButton: { shadow: 'none' } },
        dark: { navButton: { shadow: 'none' } },
      },
    },
    tag: {
      root: {
        fontSize: '0.75rem',
        fontWeight: '500',
        padding: '0.25rem 0.625rem',
        gap: '0.375rem',
        borderRadius: '{border.radius.sm}',
        roundedBorderRadius: PILL,
      },
      colorScheme: { light: TAG_SCHEME, dark: TAG_SCHEME },
    },
    toast: {
      root: { width: '24rem', borderRadius: '{border.radius.xs}', borderWidth: '0' },
      content: { padding: '0.875rem 1rem', gap: '0.75rem' },
      summary: { fontWeight: '500', fontSize: '0.875rem' },
      detail: { fontWeight: '400', fontSize: '0.875rem' },
      colorScheme: { light: snackbar(), dark: snackbar() },
    },
    message: {
      root: { borderRadius: '{border.radius.md}' },
    },
    toggleswitch: {
      root: {
        width: '3.25rem',
        height: '2rem',
        borderRadius: PILL,
        gap: '0.375rem',
        borderWidth: '2px',
        borderColor: '{md.outline}',
        hoverBorderColor: '{md.on.surface.variant}',
        checkedBorderColor: '{md.primary}',
        checkedHoverBorderColor: '{md.primary}',
      },
      handle: { borderRadius: PILL, size: '1.25rem' },
      colorScheme: { light: SWITCH_SCHEME, dark: SWITCH_SCHEME },
    },
    togglebutton: {
      root: { padding: '0', borderRadius: PILL, fontWeight: '500' },
      content: { padding: '0.5rem 1rem', borderRadius: PILL, checkedShadow: 'none' },
      colorScheme: { light: TOGGLE_SCHEME, dark: TOGGLE_SCHEME },
    },
    selectbutton: {
      root: { borderRadius: PILL },
    },
    checkbox: {
      root: {
        borderRadius: '2px',
        width: '1.125rem',
        height: '1.125rem',
        borderColor: '{md.on.surface.variant}',
      },
    },
    radiobutton: {
      root: { borderColor: '{md.on.surface.variant}' },
    },
    datatable: {
      headerCell: {
        background: 'transparent',
        color: '{md.on.surface.variant}',
        borderColor: '{md.outline.variant}',
      },
      columnTitle: { fontWeight: '500' },
      row: {
        background: 'transparent',
        hoverBackground: over('{md.on.surface}', 8),
        color: '{md.on.surface}',
      },
      bodyCell: { borderColor: '{md.outline.variant}' },
      colorScheme: {
        light: { root: { borderColor: '{md.outline.variant}' } },
        dark: { root: { borderColor: '{md.outline.variant}' } },
      },
    },
    tooltip: {
      root: { padding: '0.25rem 0.5rem', borderRadius: '{border.radius.xs}', shadow: 'none' },
      colorScheme: {
        light: { root: { background: '{md.inverse.surface}', color: '{md.inverse.on.surface}' } },
        dark: { root: { background: '{md.inverse.surface}', color: '{md.inverse.on.surface}' } },
      },
    },
    badge: {
      root: {
        borderRadius: PILL,
        padding: '0 0.25rem',
        fontSize: '0.6875rem',
        fontWeight: '500',
        minWidth: '1rem',
        height: '1rem',
      },
      colorScheme: {
        light: { danger: { background: '{md.error}', color: '{md.on.error}' } },
        dark: { danger: { background: '{md.error}', color: '{md.on.error}' } },
      },
    },
    progressbar: {
      root: {
        background: '{md.secondary.container}',
        borderRadius: PILL,
        height: '0.25rem',
      },
      value: { background: '{md.primary}' },
    },
    datepicker: {
      panel: { background: '{md.surface.container.high}', borderRadius: '{border.radius.lg}' },
      date: { borderRadius: PILL, width: '2.5rem', height: '2.5rem' },
    },
  },
});
