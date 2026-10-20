import { ActivatedRoute, Router } from '@angular/router';

/**
 * The tabs of a student's card (redesign spec §8), named in the address as `?tab=`; Обзор is the default and
 * is left out of the address.
 */
export const CARD_TABS = ['overview', 'lessons', 'homework', 'payments', 'profile'] as const;

export type CardTab = (typeof CARD_TABS)[number];

/** The tabs of a group's card (redesign spec §8). */
export const GROUP_TABS = ['overview', 'lessons', 'homework', 'members', 'profile'] as const;

export type GroupTab = (typeof GROUP_TABS)[number];

export const DEFAULT_TAB = 'overview';

/** The tab of `?tab=`; an unknown or missing one is Обзор. */
export function cardTab(value: string | null | undefined): CardTab {
  return CARD_TABS.find((tab) => tab === value) ?? DEFAULT_TAB;
}

/** The tab of `?tab=` on a group's card; an unknown or missing one is Обзор. */
export function groupTab(value: string | null | undefined): GroupTab {
  return GROUP_TABS.find((tab) => tab === value) ?? DEFAULT_TAB;
}

/** A tab chosen: `?tab=` names it, Обзор (the first) leaves the address without it. */
export function showTab(router: Router, route: ActivatedRoute, tab: string): void {
  void router.navigate([], {
    relativeTo: route,
    queryParams: { tab: tab === DEFAULT_TAB ? null : tab },
    queryParamsHandling: 'merge',
    replaceUrl: true,
  });
}
