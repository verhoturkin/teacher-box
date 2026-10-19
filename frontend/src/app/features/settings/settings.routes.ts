import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes, UrlMatcher } from '@angular/router';
import { CORE_T } from '@core/i18n/texts';
import { SettingsPage } from './settings-page';
import { categoryOfFolds, isCategory } from './settings-categories';

/** `/teacher/settings` and `/teacher/settings/:category` are one route: the page stays, the detail changes. */
const settingsMatcher: UrlMatcher = (segments) => {
  const [category, ...rest] = segments;
  if (category === undefined) {
    return { consumed: [] };
  }
  return rest.length === 0 ? { consumed: segments, posParams: { category } } : null;
};

/**
 * Old addresses lead to a category: Google's redirects (`?google=` → «Календарь и звонки», `?drive=` →
 * «Данные», the result stays in the address for the panel) and the fold cards (`?open=portal`); an unknown
 * category — to the list.
 */
const settingsAddress: CanActivateFn = (route) => {
  const router = inject(Router);
  const category: unknown = route.params['category'];
  if (category !== undefined) {
    return isCategory(category) || router.createUrlTree(['/teacher/settings']);
  }
  const { open, google, drive } = route.queryParams as Record<string, string | undefined>;
  if (google !== undefined) {
    return router.createUrlTree(['/teacher/settings/calendar'], { queryParams: { google } });
  }
  if (drive !== undefined) {
    return router.createUrlTree(['/teacher/settings/data'], { queryParams: { drive } });
  }
  const folded = categoryOfFolds(open ?? '');
  return folded === null || router.createUrlTree(['/teacher/settings', folded]);
};

/** The teacher's settings: the list of categories and the chosen one (redesign spec §10.3). */
export const SETTINGS_ROUTES: Routes = [
  {
    matcher: settingsMatcher,
    title: CORE_T.nav.settings,
    canActivate: [settingsAddress],
    component: SettingsPage,
  },
];
