import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'teacher' },
  {
    path: 'teacher',
    loadComponent: () => import('@core/layout/teacher-layout').then((m) => m.TeacherLayout),
    children: [
      {
        path: '',
        title: 'Главная',
        loadComponent: () => import('@features/home').then((m) => m.TeacherHome),
      },
    ],
  },
  {
    path: 'cabinet',
    loadComponent: () => import('@core/layout/student-layout').then((m) => m.StudentLayout),
    children: [
      {
        path: '',
        title: 'Личный кабинет',
        loadComponent: () => import('@features/home').then((m) => m.StudentHome),
      },
    ],
  },
  {
    path: '**',
    title: 'Страница не найдена',
    loadComponent: () => import('@core/pages/not-found').then((m) => m.NotFound),
  },
];
