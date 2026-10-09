import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Shell } from './shell';

export const TEACHER_MENU: MenuItem[] = [
  {
    label: 'Главная',
    icon: 'pi pi-home',
    routerLink: '/teacher',
    routerLinkActiveOptions: { exact: true },
  },
  { label: 'Расписание', icon: 'pi pi-calendar', routerLink: '/teacher/schedule' },
  { label: 'Звонки', icon: 'pi pi-video', routerLink: '/teacher/calls' },
  { label: 'Ученики', icon: 'pi pi-users', routerLink: '/teacher/students' },
  { label: 'Задания', icon: 'pi pi-pen-to-square', routerLink: '/teacher/homework' },
  { label: 'Учебники', icon: 'pi pi-book', routerLink: '/teacher/textbooks' },
  { label: 'Оплаты', icon: 'pi pi-wallet', routerLink: '/teacher/billing' },
  { label: 'Доски', icon: 'pi pi-th-large', routerLink: '/teacher/boards' },
  { label: 'Уведомления', icon: 'pi pi-bell', routerLink: '/teacher/notifications' },
  { label: 'ИИ-помощник', icon: 'pi pi-sparkles', routerLink: '/teacher/ai' },
];

/** The sections that lead the bottom bar on a phone. */
export const TEACHER_BOTTOM_NAV: readonly string[] = [
  '/teacher',
  '/teacher/schedule',
  '/teacher/boards',
  '/teacher/billing',
];

/** The teacher's user menu: instance settings next to the account. */
export const TEACHER_USER_LINKS: MenuItem[] = [
  { label: 'Настройки', icon: 'pi pi-cog', routerLink: '/teacher/settings' },
];

/** Frame of the teacher area (`/teacher/**`). */
@Component({
  selector: 'tb-teacher-layout',
  imports: [Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-shell
    [items]="menu"
    [bottomNav]="bottomNav"
    [userLinks]="userLinks"
    homeLink="/teacher"
  />`,
})
export class TeacherLayout {
  protected readonly menu = TEACHER_MENU;
  protected readonly bottomNav = TEACHER_BOTTOM_NAV;
  protected readonly userLinks = TEACHER_USER_LINKS;
}
