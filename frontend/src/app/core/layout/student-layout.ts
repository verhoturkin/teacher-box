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
  {
    label: CORE_T.nav.materials,
    icon: 'tb-i tb-i-library_books',
    routerLink: '/cabinet/materials',
  },
  {
    label: CORE_T.nav.billing,
    icon: 'tb-i tb-i-account_balance_wallet',
    routerLink: '/cabinet/billing',
  },
];

/**
 * The five sections of the bottom bar on a phone (spec §5: Главная · Расписание · Задания · Материалы ·
 * Оплаты).
 */
export const STUDENT_BOTTOM_NAV: readonly string[] = [
  '/cabinet',
  '/cabinet/schedule',
  '/cabinet/homework',
  '/cabinet/materials',
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
