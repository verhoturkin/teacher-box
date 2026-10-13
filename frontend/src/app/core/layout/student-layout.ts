import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { CORE_T } from '@core/i18n/texts';
import { Shell } from './shell';

export const STUDENT_MENU: MenuItem[] = [
  {
    label: CORE_T.nav.home,
    icon: 'pi pi-home',
    routerLink: '/cabinet',
    routerLinkActiveOptions: { exact: true },
  },
  { label: CORE_T.nav.schedule, icon: 'pi pi-calendar', routerLink: '/cabinet/schedule' },
  { label: CORE_T.nav.homework, icon: 'pi pi-pen-to-square', routerLink: '/cabinet/homework' },
  { label: CORE_T.nav.textbooks, icon: 'pi pi-book', routerLink: '/cabinet/textbooks' },
  { label: CORE_T.nav.billing, icon: 'pi pi-wallet', routerLink: '/cabinet/billing' },
  { label: CORE_T.nav.myBoards, icon: 'pi pi-tb-board', routerLink: '/cabinet/boards' },
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
