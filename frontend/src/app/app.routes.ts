import { Routes } from '@angular/router';
import { guestGuard, redirectToHome, roleGuard } from '@core/auth/auth.guards';
import { setupGuard } from '@core/portal/setup.guard';
import { canLeaveGuard } from '@core/routing/can-leave.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: redirectToHome },
  {
    path: 'login',
    title: 'Вход',
    canActivate: [guestGuard],
    loadComponent: () => import('@features/identity').then((m) => m.LoginPage),
  },
  {
    path: 'invite/:token',
    title: 'Приглашение',
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
    title: 'Доска',
    canActivate: [roleGuard('TEACHER'), setupGuard],
    canDeactivate: [canLeaveGuard],
    data: { area: 'teacher' },
    loadComponent: () => import('@features/boards').then((m) => m.BoardPage),
  },
  {
    path: 'cabinet/boards/:id',
    title: 'Доска',
    canActivate: [roleGuard('STUDENT')],
    canDeactivate: [canLeaveGuard],
    data: { area: 'cabinet' },
    loadComponent: () => import('@features/boards').then((m) => m.BoardPage),
  },
  {
    path: 'teacher',
    canActivate: [roleGuard('TEACHER')],
    canActivateChild: [setupGuard],
    loadComponent: () => import('@core/layout/teacher-layout').then((m) => m.TeacherLayout),
    children: [
      {
        path: 'setup',
        title: 'Первоначальная настройка',
        loadComponent: () => import('@features/settings').then((m) => m.SetupPage),
      },
      {
        path: '',
        title: 'Главная',
        loadComponent: () => import('@features/home').then((m) => m.TeacherHome),
      },
      {
        path: 'students',
        title: 'Ученики',
        loadComponent: () => import('@features/identity').then((m) => m.StudentsPage),
      },
      {
        path: 'schedule',
        title: 'Расписание',
        loadComponent: () => import('@features/schedule').then((m) => m.SchedulePage),
      },
      {
        path: 'homework',
        title: 'Задания',
        loadComponent: () => import('@features/homework').then((m) => m.AssignmentsPage),
      },
      {
        path: 'homework/review',
        title: 'На проверку',
        loadComponent: () => import('@features/homework').then((m) => m.ReviewQueuePage),
      },
      {
        path: 'homework/tasks/:taskId',
        title: 'Проверка работы',
        loadComponent: () => import('@features/homework').then((m) => m.TaskReviewPage),
      },
      {
        path: 'homework/:assignmentId',
        title: 'Задание',
        loadComponent: () => import('@features/homework').then((m) => m.AssignmentPage),
      },
      {
        path: 'billing',
        title: 'Оплаты',
        loadComponent: () => import('@features/billing').then((m) => m.BillingOverviewPage),
      },
      {
        path: 'billing/report',
        title: 'Отчёт за месяц',
        loadComponent: () => import('@features/billing').then((m) => m.MonthlyReportPage),
      },
      {
        path: 'billing/students/:studentId',
        title: 'История оплат',
        loadComponent: () => import('@features/billing').then((m) => m.StudentLedgerPage),
      },
      {
        path: 'boards',
        title: 'Доски',
        loadComponent: () => import('@features/boards').then((m) => m.BoardsPage),
      },
      {
        path: 'settings',
        title: 'Настройки',
        loadComponent: () => import('@features/settings').then((m) => m.SettingsPage),
      },
      {
        path: 'ai',
        title: 'ИИ-помощник',
        loadComponent: () => import('@features/ai').then((m) => m.AiUsagePage),
      },
      {
        path: 'notifications',
        title: 'Уведомления',
        loadComponent: () => import('@features/notifications').then((m) => m.NotificationsPage),
      },
      {
        path: 'help',
        title: 'Справка',
        data: { area: 'teacher' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'help/:topic',
        title: 'Справка',
        data: { area: 'teacher' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'account',
        title: 'Мой аккаунт',
        loadComponent: () => import('@features/identity').then((m) => m.AccountPage),
      },
      {
        path: '**',
        title: 'Страница не найдена',
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
        title: 'Главная',
        loadComponent: () => import('@features/home').then((m) => m.StudentHome),
      },
      {
        path: 'schedule',
        title: 'Расписание',
        loadComponent: () => import('@features/schedule').then((m) => m.MySchedulePage),
      },
      {
        path: 'homework',
        title: 'Задания',
        loadComponent: () => import('@features/homework').then((m) => m.MyHomeworkPage),
      },
      {
        path: 'homework/:taskId',
        title: 'Задание',
        loadComponent: () => import('@features/homework').then((m) => m.MyTaskPage),
      },
      {
        path: 'billing',
        title: 'Оплаты',
        loadComponent: () => import('@features/billing').then((m) => m.MyBillingPage),
      },
      {
        path: 'boards',
        title: 'Мои доски',
        loadComponent: () => import('@features/boards').then((m) => m.MyBoardsPage),
      },
      {
        path: 'notifications',
        title: 'Уведомления',
        loadComponent: () => import('@features/notifications').then((m) => m.NotificationsPage),
      },
      {
        path: 'help',
        title: 'Справка',
        data: { area: 'cabinet' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'help/:topic',
        title: 'Справка',
        data: { area: 'cabinet' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'account',
        title: 'Мой аккаунт',
        loadComponent: () => import('@features/identity').then((m) => m.AccountPage),
      },
      {
        path: '**',
        title: 'Страница не найдена',
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
        title: 'Журнал',
        loadComponent: () => import('@features/admin').then((m) => m.LogPage),
      },
      {
        path: 'status',
        title: 'Состояние',
        loadComponent: () => import('@features/admin').then((m) => m.StatusPage),
      },
      {
        path: 'events',
        title: 'События',
        loadComponent: () => import('@features/admin').then((m) => m.EventsPage),
      },
      {
        path: 'integrations',
        title: 'Интеграции',
        loadComponent: () => import('@features/admin').then((m) => m.IntegrationsPage),
      },
      {
        path: 'backups',
        title: 'Копии',
        loadComponent: () => import('@features/admin').then((m) => m.BackupsPage),
      },
      {
        path: 'settings',
        title: 'Настройки',
        loadComponent: () => import('@features/admin').then((m) => m.SettingsPage),
      },
      {
        path: 'diagnostics',
        title: 'Диагностика',
        loadComponent: () => import('@features/admin').then((m) => m.DiagnosticsPage),
      },
      {
        path: 'help',
        title: 'Справка',
        data: { area: 'admin' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'help/:topic',
        title: 'Справка',
        data: { area: 'admin' },
        loadComponent: () => import('@features/help').then((m) => m.HelpPage),
      },
      {
        path: 'account',
        title: 'Мой аккаунт',
        loadComponent: () => import('@features/identity').then((m) => m.AccountPage),
      },
      {
        path: '**',
        title: 'Страница не найдена',
        loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFound),
      },
    ],
  },
  {
    path: '**',
    title: 'Страница не найдена',
    loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFoundPage),
  },
];
