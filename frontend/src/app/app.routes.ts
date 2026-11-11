import { Injector, inject } from '@angular/core';
import {
  CanActivateFn,
  RedirectFunction,
  Router,
  Routes,
  UrlMatchResult,
  UrlMatcher,
} from '@angular/router';
import { guestGuard, redirectToHome, roleGuard } from '@core/auth/auth.guards';
import { setupGuard } from '@core/portal/setup.guard';
import { canLeaveGuard } from '@core/routing/can-leave.guard';
import { CORE_T } from '@core/i18n/texts';
import { CALENDAR_STYLESHEET, withStyleBundle } from '@core/theme/style-bundles';
import { defer, switchMap } from 'rxjs';
import { DEV_ROUTES } from '@features/gallery';

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

/**
 * The student's `/cabinet/homework` and `/cabinet/homework/:taskId` are one route: the list stays, the task beside
 * it changes (redesign spec §9).
 */
const myHomeworkMatcher: UrlMatcher = (segments): UrlMatchResult | null => {
  const [section, task, ...rest] = segments;
  return section?.path !== 'homework' || rest.length > 0
    ? null
    : task === undefined
      ? { consumed: segments }
      : { consumed: segments, posParams: { taskId: task } };
};

/**
 * Old `/teacher/boards`, `/teacher/textbooks` and the student's `/cabinet/boards`, `/cabinet/textbooks`: the tab of
 * Materials, the query (`?student=`, `?create=`…) stays.
 */
function materialsTab(tab: 'boards' | 'textbooks', area = 'teacher'): RedirectFunction {
  return ({ queryParams }) =>
    inject(Router).createUrlTree([`/${area}/materials`], { queryParams: { ...queryParams, tab } });
}

/** The old `/admin/events` is the «События» chip of the journal. */
function adminJournal(view: 'events'): RedirectFunction {
  return ({ queryParams }) =>
    inject(Router).createUrlTree(['/admin/logs'], { queryParams: { ...queryParams, view } });
}

/** `/admin/<page>` and `/admin/<page>/:section` are one route: the list stays, the section beside it changes (247.2). */
function adminSectionMatcher(page: string): UrlMatcher {
  return (segments): UrlMatchResult | null => {
    const [first, section, ...rest] = segments;
    if (first?.path !== page || rest.length > 0) {
      return null;
    }
    return section === undefined
      ? { consumed: segments }
      : { consumed: segments, posParams: { section } };
  };
}

/**
 * The lessons ahead for the due date of a new assignment («к следующему уроку»): the editor of
 * `homework` takes them as an input, because `homework` does not import `schedule` (ADR-0058).
 * Resolves at once; the schedule's parts load when the editor asks for the lessons.
 */
const upcomingLessons = () => {
  const injector = inject(Injector);
  return (from: string, to: string) =>
    defer(() => import('@features/schedule/parts')).pipe(
      switchMap((parts) => injector.get(parts.ScheduleApi).lessons(from, to)),
    );
};

/** Pages that several routes open: one loader each. */
const assignmentEditorPage = () => import('@features/homework').then((m) => m.AssignmentEditorPage);
const boardPage = () => import('@features/boards').then((m) => m.BoardPage);
const notFoundPage = () => import('@core/pages/not-found').then((m) => m.NotFound);
const accountPage = () => import('@features/account').then((m) => m.AccountPage);
const helpPage = () => import('@features/help').then((m) => m.HelpPage);

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
    path: 'offline',
    title: CORE_T.offline.title,
    loadComponent: () => import('@core/pages/offline').then((m) => m.OfflinePage),
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
    loadComponent: boardPage,
  },
  {
    path: 'cabinet/boards/:id',
    title: N.board,
    canActivate: [roleGuard('STUDENT')],
    canDeactivate: [canLeaveGuard],
    data: { area: 'cabinet' },
    loadComponent: boardPage,
  },
  {
    // The first setup takes the whole screen, no rail (ADR-0014, sketch OnbFlow).
    path: 'teacher/setup',
    title: N.setup,
    canActivate: [roleGuard('TEACHER'), loadTeacherColors],
    loadComponent: () => import('@features/settings').then((m) => m.SetupPage),
  },
  {
    path: 'teacher',
    canActivate: [roleGuard('TEACHER'), loadTeacherColors],
    canActivateChild: [setupGuard],
    loadComponent: () => import('@core/layout/teacher-layout').then((m) => m.TeacherLayout),
    children: [
      {
        path: '',
        title: NAV.today,
        loadComponent: () => import('@features/home').then((m) => m.TeacherHome),
      },
      {
        matcher: studentsMatcher,
        title: NAV.students,
        loadComponent: () => import('@features/students').then((m) => m.StudentsPage),
      },
      // the groups are rows of the students' list (237.2)
      { path: 'groups', redirectTo: 'students' },
      {
        path: 'schedule',
        title: NAV.schedule,
        canActivate: [withStyleBundle(CALENDAR_STYLESHEET)],
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
        loadComponent: assignmentEditorPage,
        resolve: { upcomingLessons },
        canDeactivate: [canLeaveGuard],
      },
      {
        path: 'homework/:assignmentId/edit',
        title: N.editAssignment,
        loadComponent: assignmentEditorPage,
        canDeactivate: [canLeaveGuard],
      },
      {
        path: 'materials',
        title: NAV.materials,
        loadComponent: () => import('@features/materials').then((m) => m.MaterialsPage),
      },
      // boards and textbooks are the two tabs of Materials (245.2); the filters of the address stay
      { path: 'boards', pathMatch: 'full', redirectTo: materialsTab('boards') },
      { path: 'textbooks', pathMatch: 'full', redirectTo: materialsTab('textbooks') },
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
      // the rooms are in the cards and the lessons; calls are in «Занятия» of the settings (357.1)
      { path: 'calls', redirectTo: 'settings/lessons' },
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
        loadComponent: helpPage,
      },
      {
        path: 'help/:topic',
        title: N.help,
        data: { area: 'teacher' },
        loadComponent: helpPage,
      },
      // the teacher's «Мой аккаунт» is a category of the settings (234.1)
      { path: 'account', redirectTo: 'settings/account' },
      {
        path: '**',
        title: N.notFound,
        loadComponent: notFoundPage,
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
        canActivate: [withStyleBundle(CALENDAR_STYLESHEET)],
        loadComponent: () => import('@features/schedule').then((m) => m.MySchedulePage),
      },
      {
        matcher: myHomeworkMatcher,
        title: NAV.homework,
        loadComponent: () => import('@features/homework').then((m) => m.MyHomeworkPage),
      },
      {
        path: 'materials',
        title: NAV.materials,
        loadComponent: () => import('@features/materials').then((m) => m.MyMaterialsPage),
      },
      // boards and textbooks are the two tabs of Materials (245.3)
      { path: 'boards', pathMatch: 'full', redirectTo: materialsTab('boards', 'cabinet') },
      { path: 'textbooks', pathMatch: 'full', redirectTo: materialsTab('textbooks', 'cabinet') },
      {
        path: 'billing',
        title: NAV.billing,
        loadComponent: () => import('@features/billing').then((m) => m.MyBillingPage),
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
        loadComponent: helpPage,
      },
      {
        path: 'help/:topic',
        title: N.help,
        data: { area: 'cabinet' },
        loadComponent: helpPage,
      },
      {
        path: 'account',
        title: N.account,
        loadComponent: accountPage,
      },
      {
        path: '**',
        title: N.notFound,
        loadComponent: notFoundPage,
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('@core/layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'status' },
      {
        path: 'status',
        title: NAV.status,
        loadComponent: () => import('@features/admin').then((m) => m.StatusPage),
      },
      {
        // the log, the errors (`?view=errors`) and the events (`?view=events`) are the chips of the journal (247.1)
        path: 'logs',
        title: NAV.log,
        loadComponent: () => import('@features/admin').then((m) => m.JournalPage),
      },
      { path: 'events', pathMatch: 'full', redirectTo: adminJournal('events') },
      {
        matcher: adminSectionMatcher('integrations'),
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
      // the sections of the old list-detail page and its fold cards (`?open=`) are cards of one page now (363.8)
      { path: 'settings/:section', redirectTo: 'settings' },
      // the archive for the developer is collected on «Состояние»
      { path: 'diagnostics', pathMatch: 'full', redirectTo: 'status' },
      {
        path: 'help',
        title: N.help,
        data: { area: 'admin' },
        loadComponent: helpPage,
      },
      {
        path: 'help/:topic',
        title: N.help,
        data: { area: 'admin' },
        loadComponent: helpPage,
      },
      {
        path: 'account',
        title: N.account,
        loadComponent: accountPage,
      },
      {
        path: '**',
        title: N.notFound,
        loadComponent: notFoundPage,
      },
    ],
  },
  // the design gallery of development builds (ADR-0059); production builds have none
  ...DEV_ROUTES,
  {
    path: '**',
    title: N.notFound,
    loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFoundPage),
  },
];
