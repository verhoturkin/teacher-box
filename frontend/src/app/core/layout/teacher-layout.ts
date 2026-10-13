import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { CORE_T } from '@core/i18n/texts';
import { Shell } from './shell';

export const TEACHER_MENU: MenuItem[] = [
  {
    label: CORE_T.nav.home,
    icon: 'pi pi-home',
    routerLink: '/teacher',
    routerLinkActiveOptions: { exact: true },
  },
  { label: CORE_T.nav.schedule, icon: 'pi pi-calendar', routerLink: '/teacher/schedule' },
  { label: CORE_T.nav.calls, icon: 'pi pi-video', routerLink: '/teacher/calls' },
  { label: CORE_T.nav.students, icon: 'pi pi-users', routerLink: '/teacher/students' },
  { label: CORE_T.nav.homework, icon: 'pi pi-pen-to-square', routerLink: '/teacher/homework' },
  { label: CORE_T.nav.textbooks, icon: 'pi pi-book', routerLink: '/teacher/textbooks' },
  { label: CORE_T.nav.billing, icon: 'pi pi-wallet', routerLink: '/teacher/billing' },
  { label: CORE_T.nav.boards, icon: 'pi pi-tb-board', routerLink: '/teacher/boards' },
  { label: CORE_T.nav.notifications, icon: 'pi pi-bell', routerLink: '/teacher/notifications' },
  { label: CORE_T.nav.ai, icon: 'pi pi-sparkles', routerLink: '/teacher/ai' },
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
  { label: CORE_T.nav.settings, icon: 'pi pi-cog', routerLink: '/teacher/settings' },
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
