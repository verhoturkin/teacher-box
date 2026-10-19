import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { CORE_T } from '@core/i18n/texts';
import { Shell } from './shell';

export const STUDENT_MENU: MenuItem[] = [
  {
    label: CORE_T.nav.home,
    icon: 'tb-i tb-i-home',
    routerLink: '/cabinet',
    routerLinkActiveOptions: { exact: true },
  },
  { label: CORE_T.nav.schedule, icon: 'tb-i tb-i-calendar_month', routerLink: '/cabinet/schedule' },
  { label: CORE_T.nav.homework, icon: 'tb-i tb-i-assignment', routerLink: '/cabinet/homework' },
  { label: CORE_T.nav.textbooks, icon: 'tb-i tb-i-menu_book', routerLink: '/cabinet/textbooks' },
  {
    label: CORE_T.nav.billing,
    icon: 'tb-i tb-i-account_balance_wallet',
    routerLink: '/cabinet/billing',
  },
  { label: CORE_T.nav.myBoards, icon: 'tb-i tb-i-co_present', routerLink: '/cabinet/boards' },
];

/**
 * The five sections of the bottom bar on a phone (spec §5: Главная · Расписание · Задания · Материалы ·
 * Оплаты; «Мои доски» stand for «Материалы» until they ship); «Учебники» are under ☰.
 */
export const STUDENT_BOTTOM_NAV: readonly string[] = [
  '/cabinet',
  '/cabinet/schedule',
  '/cabinet/homework',
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
