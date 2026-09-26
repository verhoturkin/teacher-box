import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Shell } from './shell';

export const TEACHER_MENU: MenuItem[] = [
  { label: 'Главная', icon: 'pi pi-home', routerLink: '/teacher', routerLinkActiveOptions: { exact: true } },
  { label: 'Расписание', icon: 'pi pi-calendar', routerLink: '/teacher/schedule' },
  { label: 'Ученики', icon: 'pi pi-users', routerLink: '/teacher/students' },
  { label: 'Задания', icon: 'pi pi-book', routerLink: '/teacher/homework' },
  { label: 'Оплаты', icon: 'pi pi-wallet', routerLink: '/teacher/billing' },
  { label: 'Уведомления', icon: 'pi pi-bell', routerLink: '/teacher/notifications' },
  { label: 'ИИ', icon: 'pi pi-sparkles', routerLink: '/teacher/ai' },
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
  template: `<tb-shell [items]="menu" [userLinks]="userLinks" homeLink="/teacher" areaTitle="Кабинет учителя" />`,
})
export class TeacherLayout {
  protected readonly menu = TEACHER_MENU;
  protected readonly userLinks = TEACHER_USER_LINKS;
}
