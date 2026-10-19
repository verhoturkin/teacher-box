import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { CORE_T } from '@core/i18n/texts';
import { NotificationsPage } from './notifications-page';

/** The sections of the old page that are now the category «Мессенджеры» of the settings (234.3). */
const MOVED = new Set(['messengers', 'students', 'preferences']);

/**
 * Old links to the bots, students' messengers and what to send (`?open=messengers,students`, `?tab=students`)
 * lead to the category «Мессенджеры» of the settings; the inbox and the messages stay here.
 */
const notificationsAddress: CanActivateFn = (route) => {
  const { open, tab } = route.queryParams as Record<string, string | undefined>;
  const sections = [...(open ?? '').split(','), tab];
  return (
    !sections.some((section) => section !== undefined && MOVED.has(section)) ||
    inject(Router).createUrlTree(['/teacher/settings/messengers'])
  );
};

/** The teacher's notifications: the inbox and the messages to students. */
export const TEACHER_NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    title: CORE_T.nav.notifications,
    canActivate: [notificationsAddress],
    component: NotificationsPage,
  },
];
