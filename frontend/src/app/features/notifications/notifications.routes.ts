import { inject } from '@angular/core';
import { Params, RedirectFunction, Router, Routes } from '@angular/router';
import { NOTIFICATIONS_PARAM } from '@core/notifications/notifications-sheet-state';
import { CREATE_PARAM } from '@core/routing/create-param';

/** The sections of the old page that are now the category «Мессенджеры» of the settings (234.3). */
const MOVED = new Set(['messengers', 'students', 'preferences']);

/**
 * The notifications are in the bell's sheet (redesign spec §10.3): the old page leads to the home page of the
 * area with the sheet open (`?notifications=inbox`; «Создать › Сообщение» — `?create=message` — opens it on
 * «Отправленные», where the form of the message is). Other parameters stay.
 */
export function notificationsSheetAddress(
  home: string,
  query: Params,
): ReturnType<RedirectFunction> {
  const tab = query[CREATE_PARAM] === 'message' ? 'sent' : 'inbox';
  return inject(Router).createUrlTree([home], {
    queryParams: { ...query, [NOTIFICATIONS_PARAM]: tab },
  });
}

/**
 * Old links to the bots, students' messengers and what to send (`?open=messengers,students`, `?tab=students`)
 * lead to the category «Мессенджеры» of the settings; the others to the bell's sheet on the home page.
 */
const teacherNotificationsAddress: RedirectFunction = ({ queryParams }) => {
  const { open, tab } = queryParams as Record<string, string | undefined>;
  const sections = [...(open ?? '').split(','), tab];
  if (sections.some((section) => section !== undefined && MOVED.has(section))) {
    return inject(Router).createUrlTree(['/teacher/settings/messengers']);
  }
  const rest = Object.fromEntries(
    Object.entries(queryParams).filter(([name]) => name !== 'open' && name !== 'tab'),
  );
  return notificationsSheetAddress('/teacher', rest);
};

/** The teacher's notifications: the old address of the page (the inbox and the messages to students). */
export const TEACHER_NOTIFICATIONS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: teacherNotificationsAddress },
];
