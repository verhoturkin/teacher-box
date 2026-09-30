import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { ColorScheme, Shades, auraPalette, colorScheme } from './color-scheme';

/**
 * Material 3 Expressive on top of Aura (ADR-0017, ADR-0019, ADR-0023).
 *
 * The color of the portal is the seed: its shades 50–950 give the primary roles, and the neutral,
 * secondary and tertiary tones are tones of its hue. They are computed in the app
 * (`color-scheme.ts`) as ready colors, so the scheme does not depend on `oklch(from …)` in the
 * browser, and every text color has the contrast 4.5:1 to what it stands on. The M3 roles are the
 * tokens `md.*` (CSS variables `--p-md-*`); the PrimeNG tokens refer to them.
 */

/** Content over a background: the M3 state layer (hover 8 %, pressed 12 %). */
function layer(content: string, background: string, percent: number): string {
  return `color-mix(in srgb, ${content} ${String(percent)}%, ${background})`;
}

/**
 * The PrimeNG meanings of the roles, the same in both schemes except the background of cards:
 * the page is a container and cards lie on it lighter (light: the lowest container on the
 * container, dark: the container on the surface). Dialogs, menus and lists that pop up have the
 * background of cards and stand out by their shadow (ADR-0019).
 */
function scheme(card: string, neutral: Shades): Record<string, unknown> {
  return {
    surface: neutral,
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
      select: { background: card, borderColor: 'transparent', color: '{md.on.surface}' },
      popover: { background: card, borderColor: 'transparent', color: '{md.on.surface}' },
      modal: { background: card, borderColor: 'transparent', color: '{md.on.surface}' },
    },
    list: {
      option: {
        focusBackground: 'color-mix(in srgb, {md.on.surface} 8%, transparent)',
        selectedBackground: '{md.tertiary.container}',
        selectedFocusBackground: layer('{md.on.tertiary.container}', '{md.tertiary.container}', 12),
        color: '{md.on.surface}',
        focusColor: '{md.on.surface}',
        selectedColor: '{md.on.tertiary.container}',
        selectedFocusColor: '{md.on.tertiary.container}',
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

/**
 * The tokens that follow the color of the portal: the primary palette, the neutral palette and the
 * roles of both themes (`updatePreset` with them repaints the portal, ADR-0023).
 */
export function schemeTokens(colors: ColorScheme): Record<string, unknown> {
  return {
    primary: colors.primary,
    colorScheme: {
      light: { ...scheme('{md.surface.container.lowest}', colors.neutral), md: colors.light },
      dark: { ...scheme('{md.surface.container}', colors.neutral), md: colors.dark },
    },
  };
}

/** The scheme of the default color (indigo) until the portal tells its own. */
export const DEFAULT_SCHEME = colorScheme(auraPalette('indigo'));

const ELEVATION_2 = '0 1px 2px rgb(0 0 0 / 30%), 0 2px 6px 2px rgb(0 0 0 / 15%)';
const ELEVATION_3 = '0 1px 3px rgb(0 0 0 / 30%), 0 4px 8px 3px rgb(0 0 0 / 15%)';
const PILL = '999px';
/** Half the height of a 40 px button: round, and its corners can morph when pressed (Expressive). */
const BUTTON_SHAPE = '1.25rem';

/** A state layer of the content color over a transparent background. */
function over(content: string, percent: number): string {
  return `color-mix(in srgb, ${content} ${String(percent)}%, transparent)`;
}

/** A filled button of a role: confirming (success) or cancelling and deleting (error), ADR-0019. */
function filled(role: 'success' | 'error'): Record<string, unknown> {
  const on = `{md.on.${role}}`;
  const color = `{md.${role}}`;
  return {
    background: color,
    hoverBackground: layer(on, color, 8),
    activeBackground: layer(on, color, 12),
    borderColor: color,
    hoverBorderColor: layer(on, color, 8),
    activeBorderColor: layer(on, color, 12),
    color: on,
    hoverColor: on,
    activeColor: on,
    focusRing: { color: '{md.secondary}', shadow: 'none' },
  };
}

/** A text (or outlined) button of a role: the color of the role over the state layer. */
function plain(role: string): Record<string, unknown> {
  return {
    hoverBackground: over(`{md.${role}}`, 8),
    activeBackground: over(`{md.${role}}`, 12),
    borderColor: '{md.outline}',
    color: `{md.${role}}`,
  };
}

/**
 * Filled, tonal, outlined and text buttons (M3) for PrimeNG's plain, secondary, outlined, text;
 * success and danger give them the meaning (ADR-0019).
 */
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
      focusRing: { color: '{md.secondary}', shadow: 'none' },
    },
    success: filled('success'),
    danger: filled('error'),
  },
  outlined: {
    primary: plain('primary'),
    secondary: plain('on.surface.variant'),
    success: plain('success'),
    danger: plain('error'),
  },
  text: {
    primary: plain('primary'),
    secondary: plain('on.surface.variant'),
    success: plain('success'),
    danger: plain('error'),
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

/**
 * A severity is a role, not an Aura palette (ADR-0023): info — tertiary, warn — the warning role,
 * danger and error — error.
 */
const CONTAINERS = {
  primary: { background: '{md.primary.container}', color: '{md.on.primary.container}' },
  secondary: { background: '{md.secondary.container}', color: '{md.on.secondary.container}' },
  success: { background: '{md.success.container}', color: '{md.on.success.container}' },
  info: { background: '{md.tertiary.container}', color: '{md.on.tertiary.container}' },
  warn: { background: '{md.warning.container}', color: '{md.on.warning.container}' },
  danger: { background: '{md.error.container}', color: '{md.on.error.container}' },
  contrast: { background: '{md.inverse.surface}', color: '{md.inverse.on.surface}' },
};

/** Chips of statuses: the containers of the roles. */
const TAG_SCHEME = CONTAINERS;

/** A message (`p-message`) is a container of its role without an outline or a shadow. */
function message(role: keyof typeof CONTAINERS): Record<string, unknown> {
  const { background, color } = CONTAINERS[role];
  return {
    background,
    borderColor: 'transparent',
    color,
    shadow: 'none',
    closeButton: {
      hoverBackground: `color-mix(in srgb, ${color} 8%, transparent)`,
      focusRing: { color: '{md.secondary}', shadow: 'none' },
    },
    outlined: { color, borderColor: color },
    simple: { color },
  };
}

const MESSAGE_SCHEME = {
  info: message('info'),
  success: message('success'),
  warn: message('warn'),
  error: message('danger'),
  secondary: message('secondary'),
  contrast: message('contrast'),
};

/** A badge (a counter) is error / on-error (M3 badge); warn — warning, secondary — calm. */
const BADGE_SCHEME = {
  primary: { background: '{md.error}', color: '{md.on.error}' },
  secondary: { background: '{md.secondary.container}', color: '{md.on.secondary.container}' },
  success: { background: '{md.success}', color: '{md.on.success}' },
  info: { background: '{md.tertiary}', color: '{md.on.primary}' },
  warn: { background: '{md.warning}', color: '{md.on.warning}' },
  danger: { background: '{md.error}', color: '{md.on.error}' },
  contrast: { background: '{md.inverse.surface}', color: '{md.inverse.on.surface}' },
};

/** Buttons of a connected button group (Expressive): tonal, the selected one primary. */
const TOGGLE_SCHEME = {
  root: {
    background: '{md.secondary.container}',
    checkedBackground: '{md.primary}',
    hoverBackground: layer('{md.on.secondary.container}', '{md.secondary.container}', 8),
    borderColor: 'transparent',
    color: '{md.on.secondary.container}',
    hoverColor: '{md.on.secondary.container}',
    checkedColor: '{md.on.primary}',
    checkedBorderColor: 'transparent',
  },
  content: { checkedBackground: 'transparent' },
  icon: {
    color: '{md.on.secondary.container}',
    hoverColor: '{md.on.secondary.container}',
    checkedColor: '{md.on.primary}',
  },
};

/** A spring of the shape plus PrimeNG's own transitions of a button. */
function shapeTransition(component: string): string {
  const duration = `var(--p-${component}-transition-duration)`;
  return `background ${duration}, color ${duration}, border-color ${duration},
    outline-color ${duration}, box-shadow ${duration},
    border-radius var(--tb-spring-fast-spatial)`;
}

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

/** The button of a date field: the trailing icon of the outlined field. */
const DATE_BUTTON_SCHEME = {
  dropdown: {
    background: 'transparent',
    hoverBackground: over('{md.on.surface}', 8),
    activeBackground: over('{md.on.surface}', 12),
    color: '{md.on.surface.variant}',
    hoverColor: '{md.on.surface}',
    activeColor: '{md.on.surface}',
  },
  today: { background: '{md.primary.container}', color: '{md.on.primary.container}' },
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
    ...schemeTokens(DEFAULT_SCHEME),
    // the M3 focus indicator: 3 px of secondary, 2 px from the element (ADR-0024)
    focusRing: {
      width: '3px',
      style: 'solid',
      color: '{md.secondary}',
      offset: '2px',
      shadow: 'none',
    },
    disabledOpacity: '0.38',
    // M3 outlined text field: 56 px high (24 px line, 15 px padding, 1 px outline), ADR-0022
    formField: {
      paddingX: '1rem',
      paddingY: '0.9375rem',
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
    // M3 Expressive menus (ADR-0022): the items are rounded tiles 2 px apart inside the container
    list: {
      padding: '0.25rem',
      gap: '2px',
      header: { padding: '0.75rem 1rem 0.5rem' },
      option: { padding: '0.75rem 1rem', borderRadius: '{border.radius.md}' },
      optionGroup: { padding: '0.75rem 1rem 0.5rem', fontWeight: '500' },
    },
    content: { borderRadius: '{border.radius.md}' },
    navigation: {
      list: { padding: '0.25rem', gap: '2px' },
      item: { padding: '0.75rem 1rem', borderRadius: '{border.radius.md}', gap: '0.75rem' },
      submenuLabel: { padding: '0.75rem 1rem 0.5rem', fontWeight: '500' },
    },
    overlay: {
      select: { borderRadius: '{border.radius.lg}', shadow: ELEVATION_2 },
      popover: { borderRadius: '{border.radius.lg}', padding: '1rem', shadow: ELEVATION_2 },
      modal: { borderRadius: '{border.radius.xl}', padding: '1.5rem', shadow: ELEVATION_3 },
      navigation: { shadow: ELEVATION_2 },
    },
  },
  components: {
    button: {
      root: {
        borderRadius: BUTTON_SHAPE,
        roundedBorderRadius: BUTTON_SHAPE,
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
      // Pressed, a button squares its corners and springs back (Expressive shape morph)
      css: `
        .p-button {
          transition: ${shapeTransition('button')};
        }
        .p-button:not(:disabled):active {
          border-radius: var(--tb-shape-md);
        }
      `,
    },
    card: {
      root: {
        background: '{content.background}',
        borderRadius: '1.25rem',
        shadow: 'none',
      },
      body: { padding: '1.25rem 1.5rem', gap: '0.75rem' },
      title: { fontSize: '1.375rem', fontWeight: '500' },
      subtitle: { color: '{md.on.surface.variant}' },
    },
    dialog: {
      root: { background: '{overlay.modal.background}', borderColor: 'transparent' },
      header: { padding: '1.5rem 1.5rem 1rem', gap: '0.5rem' },
      title: { fontSize: '1.5rem', fontWeight: '500' },
      content: { padding: '0 1.5rem' },
      footer: { padding: '1.5rem', gap: '0.5rem' },
    },
    drawer: {
      root: { background: '{content.background}', borderColor: 'transparent' },
      title: { fontSize: '1.375rem', fontWeight: '400' },
    },
    menu: {
      root: {
        background: '{content.background}',
        borderColor: 'transparent',
        borderRadius: '{border.radius.lg}',
        shadow: ELEVATION_2,
      },
      list: { padding: '0.25rem', gap: '2px' },
      item: { padding: '0.75rem 1rem', borderRadius: '{border.radius.md}', gap: '0.75rem' },
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
      root: { borderRadius: '{border.radius.md}', borderWidth: '0' },
      text: { fontSize: '0.875rem', fontWeight: '400' },
      colorScheme: { light: MESSAGE_SCHEME, dark: MESSAGE_SCHEME },
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
      root: { padding: '0', borderRadius: BUTTON_SHAPE, fontWeight: '500' },
      content: { padding: '0.5625rem 1rem', borderRadius: PILL, checkedShadow: 'none' },
      colorScheme: { light: TOGGLE_SCHEME, dark: TOGGLE_SCHEME },
      css: `
        .p-togglebutton {
          font-size: 0.875rem;
          transition: ${shapeTransition('togglebutton')};
        }
        .p-togglebutton:not(:disabled):active {
          border-radius: var(--tb-shape-md);
        }
      `,
    },
    // A connected button group: 2 px apart, small inner corners, the selected button round
    selectbutton: {
      root: { borderRadius: BUTTON_SHAPE },
      css: `
        .p-selectbutton {
          gap: 2px;
        }
        .p-selectbutton .p-togglebutton {
          border-width: 1px;
          border-radius: var(--tb-shape-sm);
        }
        .p-selectbutton .p-togglebutton-checked {
          border-radius: var(--tb-shape-button);
        }
        .p-selectbutton .p-togglebutton:not(:disabled):active {
          border-radius: var(--tb-shape-md);
        }
      `,
    },
    // The loading indicator of M3 Expressive: a morphing shape in a round container
    progressspinner: {
      css: `
        .p-progressspinner {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: var(--tb-shape-2xl);
          background: var(--p-md-primary-container);
        }
        .p-progressspinner-spin {
          display: none;
        }
        .p-progressspinner::after {
          content: '';
          width: 60%;
          height: 60%;
          background: var(--p-md-primary);
          animation: tb-loading-morph 1.6s linear infinite;
        }
        @keyframes tb-loading-morph {
          0% { border-radius: 50%; transform: rotate(0deg) scale(1); }
          25% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: rotate(90deg) scale(0.9); }
          50% { border-radius: 22%; transform: rotate(180deg) scale(0.85); }
          75% { border-radius: 70% 30% 50% 50% / 30% 50% 50% 70%; transform: rotate(270deg) scale(0.9); }
          100% { border-radius: 50%; transform: rotate(360deg) scale(1); }
        }
      `,
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
      // a row is a tile of a segmented list (ADR-0020): hover tints the tile
      row: {
        background: 'transparent',
        hoverBackground: 'color-mix(in srgb, {md.on.surface} 4%, var(--tb-list-item))',
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
      colorScheme: { light: BADGE_SCHEME, dark: BADGE_SCHEME },
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
      panel: { background: '{content.background}', borderRadius: '{border.radius.lg}' },
      date: { borderRadius: PILL, width: '2.5rem', height: '2.5rem' },
      dropdown: {
        width: '3rem',
        borderColor: '{form.field.border.color}',
        hoverBorderColor: '{form.field.border.color}',
        activeBorderColor: '{form.field.border.color}',
        borderRadius: '{border.radius.xs}',
      },
      colorScheme: { light: DATE_BUTTON_SCHEME, dark: DATE_BUTTON_SCHEME },
      // M3 text field with a trailing icon (ADR-0022): one outline around the input and the
      // calendar button, the focus is the outline of the whole field
      css: `
        .p-datepicker:has(.p-datepicker-dropdown) {
          border: 1px solid dt('form.field.border.color');
          border-radius: dt('form.field.border.radius');
          transition: border-color dt('form.field.transition.duration');
        }
        .p-datepicker:has(.p-datepicker-dropdown):hover {
          border-color: dt('form.field.hover.border.color');
        }
        .p-datepicker:has(.p-datepicker-dropdown):focus-within {
          border-color: dt('form.field.focus.border.color');
          box-shadow: inset 0 0 0 1px dt('form.field.focus.border.color');
        }
        .p-datepicker:has(.p-datepicker-dropdown) .p-datepicker-input,
        .p-datepicker:has(.p-datepicker-dropdown) .p-datepicker-input:enabled:hover,
        .p-datepicker:has(.p-datepicker-dropdown) .p-datepicker-input:enabled:focus {
          border: 0;
          outline: none;
          box-shadow: none;
          background: transparent;
        }
        .p-datepicker .p-datepicker-dropdown,
        .p-datepicker .p-datepicker-dropdown:not(:disabled):hover {
          border: 0;
          background: transparent;
          color: dt('form.field.icon.color');
        }
      `,
    },
  },
});
