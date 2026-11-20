import { Routes } from '@angular/router';
import { CORE_T } from '@core/i18n/texts';
import { CALENDAR_STYLESHEET, withStyleBundle } from '@core/theme/style-bundles';
import { BillingApi } from '@features/billing/parts';
import { HomeworkApi } from '@features/homework/parts';
import { ScheduleApi } from '@features/schedule/parts';
import { myHomeworkMatcher } from '@core/routing/my-homework-matcher';

/**
 * The pages of the family cabinet (`/family/:studentId/...`, 453.2): the student's own pages over the
 * child's data. The parent route gives them the family scope, this one its own API clients, which take
 * their addresses from it (`/api/guardian/students/<id>/...`), so no page is copied (ADR-0069).
 */
export const FAMILY_ROUTES: Routes = [
  {
    path: '',
    // own clients over the family scope of `/family/:studentId` (app.routes.ts)
    providers: [ScheduleApi, HomeworkApi, BillingApi],
    children: [
      {
        path: '',
        title: CORE_T.nav.home,
        loadComponent: () => import('./student-home').then((m) => m.StudentHome),
      },
      {
        path: 'schedule',
        title: CORE_T.nav.schedule,
        canActivate: [withStyleBundle(CALENDAR_STYLESHEET)],
        loadComponent: () => import('@features/schedule').then((m) => m.MySchedulePage),
      },
      {
        matcher: myHomeworkMatcher,
        title: CORE_T.nav.homework,
        loadComponent: () => import('@features/homework').then((m) => m.MyHomeworkPage),
      },
      {
        path: 'billing',
        title: CORE_T.nav.billing,
        loadComponent: () => import('@features/billing').then((m) => m.MyBillingPage),
      },
      {
        path: '**',
        title: CORE_T.titles.notFound,
        loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
