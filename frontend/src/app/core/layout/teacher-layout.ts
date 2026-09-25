import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Shell } from './shell';

export const TEACHER_MENU: MenuItem[] = [
  { label: 'Главная', icon: 'pi pi-home', routerLink: '/teacher', routerLinkActiveOptions: { exact: true } },
  { label: 'Ученики', icon: 'pi pi-users', routerLink: '/teacher/students' },
  { label: 'Задания', icon: 'pi pi-book', routerLink: '/teacher/homework' },
  { label: 'Оплаты', icon: 'pi pi-wallet', routerLink: '/teacher/billing' },
  { label: 'ИИ', icon: 'pi pi-sparkles', routerLink: '/teacher/ai' },
  { label: 'Настройки', icon: 'pi pi-cog', routerLink: '/teacher/settings' },
];

/** Frame of the teacher area (`/teacher/**`). */
@Component({
  selector: 'tb-teacher-layout',
  imports: [Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-shell [items]="menu" homeLink="/teacher" areaTitle="Кабинет учителя" />`,
})
export class TeacherLayout {
  protected readonly menu = TEACHER_MENU;
}
