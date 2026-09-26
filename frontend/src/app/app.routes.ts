import { Routes } from '@angular/router';
import { guestGuard, redirectToHome, roleGuard } from '@core/auth/auth.guards';

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
    path: 'teacher',
    canActivate: [roleGuard('TEACHER')],
    loadComponent: () => import('@core/layout/teacher-layout').then((m) => m.TeacherLayout),
    children: [
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
        title: 'Домашние задания',
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
        path: 'account',
        title: 'Мой аккаунт',
        loadComponent: () => import('@features/identity').then((m) => m.AccountPage),
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
        title: 'Личный кабинет',
        loadComponent: () => import('@features/home').then((m) => m.StudentHome),
      },
      {
        path: 'schedule',
        title: 'Расписание',
        loadComponent: () => import('@features/schedule').then((m) => m.MySchedulePage),
      },
      {
        path: 'homework',
        title: 'Домашние задания',
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
        path: 'notifications',
        title: 'Уведомления',
        loadComponent: () => import('@features/notifications').then((m) => m.NotificationsPage),
      },
      {
        path: 'account',
        title: 'Мой аккаунт',
        loadComponent: () => import('@features/identity').then((m) => m.AccountPage),
      },
    ],
  },
  {
    path: '**',
    title: 'Страница не найдена',
    loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFound),
  },
];
