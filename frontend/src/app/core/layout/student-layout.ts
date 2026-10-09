import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Shell } from './shell';

export const STUDENT_MENU: MenuItem[] = [
  {
    label: 'Главная',
    icon: 'pi pi-home',
    routerLink: '/cabinet',
    routerLinkActiveOptions: { exact: true },
  },
  { label: 'Расписание', icon: 'pi pi-calendar', routerLink: '/cabinet/schedule' },
  { label: 'Задания', icon: 'pi pi-pen-to-square', routerLink: '/cabinet/homework' },
  { label: 'Учебники', icon: 'pi pi-book', routerLink: '/cabinet/textbooks' },
  { label: 'Оплаты', icon: 'pi pi-wallet', routerLink: '/cabinet/billing' },
  { label: 'Мои доски', icon: 'pi pi-th-large', routerLink: '/cabinet/boards' },
];

/** The sections that lead the bottom bar on a phone. */
export const STUDENT_BOTTOM_NAV: readonly string[] = [
  '/cabinet',
  '/cabinet/schedule',
  '/cabinet/boards',
  '/cabinet/billing',
];

/** Frame of the student personal area (`/cabinet/**`). */
@Component({
  selector: 'tb-student-layout',
  imports: [Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-shell [items]="menu" [bottomNav]="bottomNav" homeLink="/cabinet" />`,
})
export class StudentLayout {
  protected readonly menu = STUDENT_MENU;
  protected readonly bottomNav = STUDENT_BOTTOM_NAV;
}
