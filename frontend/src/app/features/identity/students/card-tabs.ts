/**
 * The tabs of a student's card (redesign spec §8), named in the address as `?tab=`; Обзор is the default and
 * is left out of the address. 237.4–237.5 add Занятия, Задания, Оплаты and Профиль.
 */
export const CARD_TABS = ['overview'] as const;

export type CardTab = (typeof CARD_TABS)[number];

export const DEFAULT_TAB: CardTab = 'overview';

/** The tab of `?tab=`; an unknown or missing one is Обзор. */
export function cardTab(value: string | null | undefined): CardTab {
  return CARD_TABS.find((tab) => tab === value) ?? DEFAULT_TAB;
}
