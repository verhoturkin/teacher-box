import { Injector, inject } from '@angular/core';
import { CanActivateFn, Routes, UrlMatchResult, UrlMatcher } from '@angular/router';
import { guestGuard, redirectToHome, roleGuard } from '@core/auth/auth.guards';
import { setupGuard } from '@core/portal/setup.guard';
import { canLeaveGuard } from '@core/routing/can-leave.guard';
import { CORE_T } from '@core/i18n/texts';

/**
 * Opens the teacher's area and loads the colours of the students and groups for its lists in the background;
 * the identity parts are loaded lazily, out of the first bundle.
 */
const loadTeacherColors: CanActivateFn = async () => {
  const injector = inject(Injector);
  const parts = await import('@features/identity/parts');
  injector.get(parts.TeacherColors).load();
  return true;
};

/**
 * `/teacher/students`, `/teacher/students/:studentId` and `/teacher/groups/:groupId` are one route: the list
 * stays, the card beside it changes (redesign spec §8).
 */
const studentsMatcher: UrlMatcher = (segments): UrlMatchResult | null => {
  const [section, id, ...rest] = segments;
  if (rest.length > 0) {
    return null;
  }
  if (section?.path === 'students') {
    return { consumed: segments, posParams: id === undefined ? {} : { studentId: id } };
  }
  return section?.path === 'groups' && id !== undefined
    ? { consumed: segments, posParams: { groupId: id } }
    : null;
};

/**
 * `/teacher/homework`, `/teacher/homework/tasks/:taskId` and `/teacher/homework/:assignmentId` are one route: the
 * list stays, the work or the assignment beside it changes (redesign spec §9). `new` and the editor are routes
 * of their own.
 */
const homeworkMatcher: UrlMatcher = (segments): UrlMatchResult | null => {
  const [section, first, second, ...rest] = segments;
  if (section?.path !== 'homework' || rest.length > 0) {
    return null;
  }
  if (first === undefined) {
    return { consumed: segments };
  }
  if (first.path === 'tasks') {
    return second === undefined ? null : { consumed: segments, posParams: { taskId: second } };
  }
  return second !== undefined || first.path === 'new' || first.path === 'review'
    ? null
    : { consumed: segments, posParams: { assignmentId: first } };
};

const N = CORE_T.titles;
const NAV = CORE_T.nav;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: redirectToHome },
  {
    path: 'login',
    title: N.signIn,
    canActivate: [guestGuard],
    loadComponent: () => import('@features/identity').then((m) => m.LoginPage),
  },
  {
    path: 'invite/:token',
    title: N.invite,
    loadComponent: () => import('@features/identity').then((m) => m.InvitePage),
  },
  {
    // The link of a built-in room (ADR-0030): opens the call over the user's pages.
    path: 'call/:ownerId',
    loadChildren: () => import('@features/meetings').then((m) => m.CALL_ROUTES),
  },
  {
    // The board editor takes the whole screen: outside the shell, same guards (ADR-0028).
    path: 'teacher/boards/:id',
    title: N.board,
    canActivate: [roleGuard('TEACHER'), setupGuard],
    canDeactivate: [canLeaveGuard],
    data: { area: 'teacher' },
    loadComponent: () => import('@features/boards').then((m) => m.BoardPage),
  },
  {
    path: 'cabinet/boards/:id',
    title: N.board,
    canActivate: [roleGuard('STUDENT')],
    canDeactivate: [canLeaveGuard],
    data: { area: 'cabinet' },
    loadComponent: () => import('@features/boards').then((m) => m.BoardPage),
  },
  {
    path: 'teacher',
    canActivate: [roleGuard('TEACHER'), loadTeacherColors],
    canActivateChild: [setupGuard],
    loadComponent: () => import('@core/layout/teacher-layout').then((m) => m.TeacherLayout),
    children: [
      {
        path: 'setup',
        title: N.setup,
        loadComponent: () => import('@features/settings').then((m) => m.SetupPage),
      },
      {
        path: '',
        title: NAV.today,
        loadComponent: () => import('@features/home').then((m) => m.TeacherHome),
      },
      {
        matcher: studentsMatcher,
        title: NAV.students,
        loadComponent: () => import('@features/identity').then((m) => m.StudentsPage),
      },
      // the groups are rows of the students' list (237.2)
      { path: 'groups', redirectTo: 'students' },
      {
        path: 'schedule',
        title: NAV.schedule,
        loadComponent: () => import('@features/schedule').then((m) => m.SchedulePage),
      },
      {
        matcher: homeworkMatcher,
        title: NAV.homework,
        loadComponent: () => import('@features/homework').then((m) => m.AssignmentsPage),
      },
      {
        // the queue is the «На проверку» filter of the list (242.1)
        path: 'homework/review',
        redirectTo: 'homework',
      },
      {
        path: 'homework/new',
        title: N.newAssignment,
        loadComponent: () => import('@features/homework').then((m) => m.AssignmentEditorPage),
        canDeactivate: [canLeaveGuard],
      },
      {
        path: 'homework/:assignmentId/edit',
        title: N.editAssignment,
        loadComponent: () => import('@features/homework').then((m) => m.AssignmentEditorPage),
        canDeactivate: [canLeaveGuard],
      },
      {
        path: 'textbooks',
        title: NAV.textbooks,
        loadComponent: () => import('@features/textbooks').then((m) => m.TextbooksPage),
      },
      {
        path: 'billing',
        title: NAV.billing,
        loadComponent: () => import('@features/billing').then((m) => m.BillingOverviewPage),
      },
      {
        path: 'billing/report',
        title: N.monthlyReport,
        loadComponent: () => import('@features/billing').then((m) => m.MonthlyReportPage),
      },
      // the history of a student's payments is the Оплаты tab of the card (237.4)
      {
        path: 'billing/students/:studentId',
        redirectTo: '/teacher/students/:studentId?tab=payments',
      },
      {
        path: 'boards',
        title: NAV.boards,
        loadComponent: () => import('@features/boards').then((m) => m.BoardsPage),
      },
      // the rooms are in the cards and the lessons; «Звонки» is a category of the settings (234.2)
      { path: 'calls', redirectTo: 'settings/calls' },
      {
        // `/teacher/settings[/:category]`: list-detail of the categories (redesign spec §10.3)
        path: 'settings',
        loadChildren: () => import('@features/settings').then((m) => m.SETTINGS_ROUTES),
      },
      // the AI assistant is a category of the settings (234.4)
      { path: 'ai', redirectTo: 'settings/ai' },
      {
        // the inbox and the messages; old links to the bots and messengers lead to the settings (234.3)
        path: 'notifications',
        loadChildren: () =>
          import('@features/notifications').then((m) => m.TEACHER_NOTIFICATIONS_ROUTES),
      },
      {
        path: 'help',
        title: N.help,
        data: { area: 'teacher' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'help/:topic',
        title: N.help,
        data: { area: 'teacher' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      // the teacher's «Мой аккаунт» is a category of the settings (234.1)
      { path: 'account', redirectTo: 'settings/account' },
      {
        path: '**',
        title: N.notFound,
        loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFound),
      },
    ],
  },
  {
    path: 'cabinet',
    canActivate: [roleGuard('STUDENT')],
    loadComponent: () => import('@core/layout/student-layout').then((m) => m.StudentLayout),
    children: [
      {
        path: '',
        title: NAV.home,
        loadComponent: () => import('@features/home').then((m) => m.StudentHome),
      },
      {
        path: 'schedule',
        title: NAV.schedule,
        loadComponent: () => import('@features/schedule').then((m) => m.MySchedulePage),
      },
      {
        path: 'homework',
        title: NAV.homework,
        loadComponent: () => import('@features/homework').then((m) => m.MyHomeworkPage),
      },
      {
        path: 'homework/:taskId',
        title: N.assignment,
        loadComponent: () => import('@features/homework').then((m) => m.MyTaskPage),
      },
      {
        path: 'textbooks',
        title: NAV.textbooks,
        loadComponent: () => import('@features/textbooks').then((m) => m.MyTextbooksPage),
      },
      {
        path: 'billing',
        title: NAV.billing,
        loadComponent: () => import('@features/billing').then((m) => m.MyBillingPage),
      },
      {
        path: 'boards',
        title: NAV.myBoards,
        loadComponent: () => import('@features/boards').then((m) => m.MyBoardsPage),
      },
      {
        // the inbox is in the bell's sheet, the messengers in «Мой аккаунт» (235.2)
        path: 'notifications',
        loadChildren: () =>
          import('@features/notifications').then((m) => m.STUDENT_NOTIFICATIONS_ROUTES),
      },
      {
        path: 'help',
        title: N.help,
        data: { area: 'cabinet' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'help/:topic',
        title: N.help,
        data: { area: 'cabinet' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'account',
        title: N.account,
        loadComponent: () => import('@features/identity').then((m) => m.AccountPage),
      },
      {
        path: '**',
        title: N.notFound,
        loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFound),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('@core/layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'logs' },
      {
        path: 'logs',
        title: NAV.log,
        loadComponent: () => import('@features/admin').then((m) => m.LogPage),
      },
      {
        path: 'status',
        title: NAV.status,
        loadComponent: () => import('@features/admin').then((m) => m.StatusPage),
      },
      {
        path: 'events',
        title: NAV.events,
        loadComponent: () => import('@features/admin').then((m) => m.EventsPage),
      },
      {
        path: 'integrations',
        title: NAV.integrations,
        loadComponent: () => import('@features/admin').then((m) => m.IntegrationsPage),
      },
      {
        path: 'backups',
        title: NAV.backups,
        loadComponent: () => import('@features/admin').then((m) => m.BackupsPage),
      },
      {
        path: 'settings',
        title: NAV.settings,
        loadComponent: () => import('@features/admin').then((m) => m.SettingsPage),
      },
      {
        path: 'diagnostics',
        title: NAV.diagnostics,
        loadComponent: () => import('@features/admin').then((m) => m.DiagnosticsPage),
      },
      {
        path: 'help',
        title: N.help,
        data: { area: 'admin' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'help/:topic',
        title: N.help,
        data: { area: 'admin' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'account',
        title: N.account,
        loadComponent: () => import('@features/identity').then((m) => m.AccountPage),
      },
      {
        path: '**',
        title: N.notFound,
        loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFound),
      },
    ],
  },
  {
    path: '**',
    title: N.notFound,
    loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFoundPage),
  },
];
