import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Aura with an indigo primary palette (the color of the portal can replace it, see portal-theme),
 * rounder corners on one scale (buttons and fields 8 px, cards and dialogs 14 px), card titles
 * that match the page titles and tabs that lie on the page (no white strip or panel behind them).
 */
export const TeacherBoxPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '2px',
      sm: '4px',
      md: '8px',
      lg: '10px',
      xl: '14px',
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
  },
  components: {
    card: {
      root: {
        shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.08)',
      },
      title: {
        fontSize: '1.125rem',
        fontWeight: '600',
      },
    },
    tabs: {
      tablist: {
        background: 'transparent',
      },
      tab: {
        padding: '0.75rem 1rem',
      },
      tabpanel: {
        background: 'transparent',
        padding: '1rem 0 0 0',
      },
      navButton: {
        background: 'transparent',
      },
      activeBar: {
        height: '2px',
        bottom: '-1px',
      },
      colorScheme: {
        light: { navButton: { shadow: 'none' } },
        dark: { navButton: { shadow: 'none' } },
      },
    },
  },
});
