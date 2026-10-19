import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { CORE_T } from '@core/i18n/texts';
import { Shell } from './shell';

export const TEACHER_MENU: MenuItem[] = [
  {
    label: CORE_T.nav.home,
    icon: 'tb-i tb-i-home',
    routerLink: '/teacher',
    routerLinkActiveOptions: { exact: true },
  },
  { label: CORE_T.nav.schedule, icon: 'tb-i tb-i-calendar_month', routerLink: '/teacher/schedule' },
  { label: CORE_T.nav.calls, icon: 'tb-i tb-i-videocam', routerLink: '/teacher/calls' },
  { label: CORE_T.nav.students, icon: 'tb-i tb-i-group', routerLink: '/teacher/students' },
  { label: CORE_T.nav.homework, icon: 'tb-i tb-i-assignment', routerLink: '/teacher/homework' },
  { label: CORE_T.nav.textbooks, icon: 'tb-i tb-i-menu_book', routerLink: '/teacher/textbooks' },
  {
    label: CORE_T.nav.billing,
    icon: 'tb-i tb-i-account_balance_wallet',
    routerLink: '/teacher/billing',
  },
  { label: CORE_T.nav.boards, icon: 'tb-i tb-i-co_present', routerLink: '/teacher/boards' },
  {
    label: CORE_T.nav.notifications,
    icon: 'tb-i tb-i-notifications',
    routerLink: '/teacher/notifications',
  },
  { label: CORE_T.nav.ai, icon: 'tb-i tb-i-auto_awesome', routerLink: '/teacher/ai' },
];

/** The sections that lead the bottom bar on a phone. */
export const TEACHER_BOTTOM_NAV: readonly string[] = [
  '/teacher',
  '/teacher/schedule',
  '/teacher/boards',
  '/teacher/billing',
];

/** The bottom of the rail before «Справка»: the settings of the instance (spec §3.2). */
export const TEACHER_FOOTER_LINKS: MenuItem[] = [
  { label: CORE_T.nav.settings, icon: 'tb-i tb-i-settings', routerLink: '/teacher/settings' },
];

/** Frame of the teacher area (`/teacher/**`). */
@Component({
  selector: 'tb-teacher-layout',
  imports: [Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-shell
    [items]="menu"
    [bottomNav]="bottomNav"
    [footerLinks]="footerLinks"
    homeLink="/teacher"
  />`,
})
export class TeacherLayout {
  protected readonly menu = TEACHER_MENU;
  protected readonly bottomNav = TEACHER_BOTTOM_NAV;
  protected readonly footerLinks = TEACHER_FOOTER_LINKS;
}
