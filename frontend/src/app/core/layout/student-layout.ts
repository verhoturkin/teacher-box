import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Shell } from './shell';

export const STUDENT_MENU: MenuItem[] = [
  { label: 'Главная', icon: 'pi pi-home', routerLink: '/cabinet', routerLinkActiveOptions: { exact: true } },
  { label: 'Оплаты', icon: 'pi pi-wallet', routerLink: '/cabinet/billing' },
];

/** Frame of the student personal area (`/cabinet/**`). */
@Component({
  selector: 'tb-student-layout',
  imports: [Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-shell [items]="menu" homeLink="/cabinet" areaTitle="Личный кабинет" />`,
})
export class StudentLayout {
  protected readonly menu = STUDENT_MENU;
}
