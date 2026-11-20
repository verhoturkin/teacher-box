import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { CORE_T } from '@core/i18n/texts';
import { NavItem, injectUrl } from './nav-item';
import { OpenTasks } from './open-tasks';
import { PaymentsVisibility } from './payments-visibility';
import { Shell } from './shell';

/**
 * The five destinations of the student (spec §5): Главная · Расписание · Задания · Материалы · Оплаты. The
 * badge on «Задания» is the number of open tasks; the rest of the old menu is elsewhere — the inbox in the
 * bell, the account, the messengers and the preferences in «Мой аккаунт», the help at the bottom of the rail.
 * No «Оплаты» when the teacher hid the payments from the student (`payments: false`, 452.3).
 */
export function studentMenu(openTasks: NavItem['count'], payments = true): NavItem[] {
  const items: NavItem[] = [
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
  return payments ? items : items.filter((item) => item.routerLink !== '/cabinet/billing');
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
  template: `<tb-shell [items]="menu()" [bottomNav]="bottomNav" homeLink="/cabinet" />`,
})
export class StudentLayout {
  private readonly openTasks = inject(OpenTasks);
  private readonly payments = inject(PaymentsVisibility);

  protected readonly menu = computed(() =>
    studentMenu(this.openTasks.count, this.payments.visible()),
  );
  protected readonly bottomNav = STUDENT_BOTTOM_NAV;

  constructor() {
    this.payments.load().subscribe();
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
