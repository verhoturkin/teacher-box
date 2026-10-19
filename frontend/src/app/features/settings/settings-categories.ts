import { T } from './i18n/texts';

/**
 * The categories of the settings in the order of the list (redesign spec §10.3); the address is
 * `/teacher/settings/<category>`. «Календарь и звонки» and «Мессенджеры» hold what the old page had until
 * 234.2 and 234.3 fill them.
 */
export const CATEGORIES = ['account', 'portal', 'calendar', 'messengers', 'data'] as const;
export type SettingsCategory = (typeof CATEGORIES)[number];

export function isCategory(value: unknown): value is SettingsCategory {
  return CATEGORIES.some((category) => category === value);
}

/** An item of the list: its icon, name and what it holds. */
export interface CategoryItem {
  readonly id: SettingsCategory;
  readonly icon: string;
  readonly title: string;
  readonly summary: string;
}

const t = T.page;

/** The first category: the detail of `/teacher/settings` beside the list. */
export const FIRST_CATEGORY: CategoryItem = {
  id: 'account',
  icon: 'tb-i-badge',
  title: t.account,
  summary: t.accountSummary,
};

export const CATEGORY_ITEMS: readonly CategoryItem[] = [
  FIRST_CATEGORY,
  { id: 'portal', icon: 'tb-i-palette', title: t.portal, summary: t.portalSummary },
  { id: 'calendar', icon: 'tb-i-calendar_month', title: t.calendar, summary: t.calendarSummary },
  { id: 'messengers', icon: 'tb-i-chat', title: t.messengers, summary: t.deliveriesSummary },
  { id: 'data', icon: 'tb-i-database', title: t.data, summary: t.dataSummary },
];

/** The fold cards of the old page (`?open=portal,data`) → their category. */
const FOLDS: Readonly<Record<string, SettingsCategory>> = {
  portal: 'portal',
  calendar: 'calendar',
  deliveries: 'messengers',
  data: 'data',
};

/** The category an old address of the settings opened: its first known fold card, or none. */
export function categoryOfFolds(open: string): SettingsCategory | null {
  for (const fold of open.split(',')) {
    const category = FOLDS[fold];
    if (category !== undefined) {
      return category;
    }
  }
  return null;
}
