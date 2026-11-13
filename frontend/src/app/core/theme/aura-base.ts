import badge from '@primeuix/themes/aura/badge';
import base from '@primeuix/themes/aura/base';
import button from '@primeuix/themes/aura/button';
import card from '@primeuix/themes/aura/card';
import checkbox from '@primeuix/themes/aura/checkbox';
import chip from '@primeuix/themes/aura/chip';
import colorpicker from '@primeuix/themes/aura/colorpicker';
import confirmdialog from '@primeuix/themes/aura/confirmdialog';
import auraCss from '@primeuix/themes/aura/css';
import datatable from '@primeuix/themes/aura/datatable';
import datepicker from '@primeuix/themes/aura/datepicker';
import dialog from '@primeuix/themes/aura/dialog';
import drawer from '@primeuix/themes/aura/drawer';
import iconfield from '@primeuix/themes/aura/iconfield';
import inputnumber from '@primeuix/themes/aura/inputnumber';
import inputtext from '@primeuix/themes/aura/inputtext';
import menu from '@primeuix/themes/aura/menu';
import message from '@primeuix/themes/aura/message';
import multiselect from '@primeuix/themes/aura/multiselect';
import overlaybadge from '@primeuix/themes/aura/overlaybadge';
import paginator from '@primeuix/themes/aura/paginator';
import password from '@primeuix/themes/aura/password';
import popover from '@primeuix/themes/aura/popover';
import progressbar from '@primeuix/themes/aura/progressbar';
import radiobutton from '@primeuix/themes/aura/radiobutton';
import ripple from '@primeuix/themes/aura/ripple';
import select from '@primeuix/themes/aura/select';
import selectbutton from '@primeuix/themes/aura/selectbutton';
import tabs from '@primeuix/themes/aura/tabs';
import tag from '@primeuix/themes/aura/tag';
import textarea from '@primeuix/themes/aura/textarea';
import toast from '@primeuix/themes/aura/toast';
import togglebutton from '@primeuix/themes/aura/togglebutton';
import toggleswitch from '@primeuix/themes/aura/toggleswitch';
import tooltip from '@primeuix/themes/aura/tooltip';
import virtualscroller from '@primeuix/themes/aura/virtualscroller';

/**
 * The part of Aura the portal uses. `@primeuix/themes/aura` holds the tokens of every PrimeNG
 * component, and a preset built on it carries all of them into the first bundle; here the base is
 * put together from Aura's own entry points, the way its index does it.
 *
 * The components are the ones whose tokens the PrimeNG modules of the app read — the modules
 * imported under `src/app` and the ones those import in turn (a table brings a paginator, a
 * multiselect a chip and a scroller, a button the ripple). `aura-base.spec.ts` computes that list
 * from the sources and fails when it differs from this one: a new `primeng/<module>` in the app
 * adds its part here, the last use of a module removes it.
 */
export const AURA_COMPONENTS = {
  badge,
  button,
  card,
  checkbox,
  chip,
  colorpicker,
  confirmdialog,
  datatable,
  datepicker,
  dialog,
  drawer,
  iconfield,
  inputnumber,
  inputtext,
  menu,
  message,
  multiselect,
  overlaybadge,
  paginator,
  password,
  popover,
  progressbar,
  radiobutton,
  ripple,
  select,
  selectbutton,
  tabs,
  tag,
  textarea,
  toast,
  togglebutton,
  toggleswitch,
  tooltip,
  virtualscroller,
};

/** The palettes and the meanings of Aura: its `primitive` and `semantic` tokens. */
export const AuraTokens = base;

/**
 * The rules Aura adds to its tokens. The package types this entry as a named export `css`, while
 * its code has only the default one, so the value is checked here.
 */
const rules: unknown = auraCss;

/** Aura with the components of the portal only: the base of the preset. */
export const AuraBase = {
  ...base,
  components: AURA_COMPONENTS,
  css: typeof rules === 'string' ? rules : undefined,
};
