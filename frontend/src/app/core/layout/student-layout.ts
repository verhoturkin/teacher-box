import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { CORE_T } from '@core/i18n/texts';
import { NavItem, injectUrl } from './nav-item';
import { OpenTasks } from './open-tasks';
import { Shell } from './shell';

/**
 * The five destinations of the student (spec §5): Главная · Расписание · Задания · Материалы · Оплаты. The
 * badge on «Задания» is the number of open tasks; the rest of the old menu is elsewhere — the inbox in the
 * bell, the account, the messengers and the preferences in «Мой аккаунт», the help at the bottom of the rail.
 */
export function studentMenu(openTasks: NavItem['count']): NavItem[] {
  return [
    {
      label: CORE_T.nav.home,
      icon: 'tb-i tb-i-home',
      routerLink: '/cabinet',
      routerLinkActiveOptions: { exact: true },
    },
    {
      label: CORE_T.nav.schedule,
      icon: 'tb-i tb-i-calendar_month',
      routerLink: '/cabinet/schedule',
    },
    {
      label: CORE_T.nav.homework,
      icon: 'tb-i tb-i-assignment',
      routerLink: '/cabinet/homework',
      count: openTasks,
      countLabel: CORE_T.nav.openTasks,
    },
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
}

/** All five are in the bottom bar on a phone, no «Ещё» (spec §5). */
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
  private readonly openTasks = inject(OpenTasks);

  protected readonly menu = studentMenu(this.openTasks.count);
  protected readonly bottomNav = STUDENT_BOTTOM_NAV;

  constructor() {
    // the counter follows the student: on entering and after each navigation (a task was handed in)
    const url = injectUrl();
    effect(() => {
      url();
      untracked(() => {
        this.openTasks.refresh();
      });
    });
  }
}
