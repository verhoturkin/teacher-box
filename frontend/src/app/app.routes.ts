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
        path: 'billing',
        title: 'Оплаты',
        loadComponent: () => import('@features/billing').then((m) => m.MyBillingPage),
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
