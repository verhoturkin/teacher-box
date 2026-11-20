import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { Family } from '@core/family/family';
import { CORE_T } from '@core/i18n/texts';
import { ChildSwitcher } from './child-switcher';
import { injectWindowSize } from './mobile';
import { NavItem } from './nav-item';
import { Shell } from './shell';

/**
 * The four destinations of the parent (453.2): Главная · Расписание · Задания · Оплаты of the child in
 * the address; «Справка» and «Мой аккаунт» are at the bottom of the rail, as for the student. No
 * «Материалы»: the textbooks of a task open from the task. *Our decision:* no counter on «Задания» —
 * the parent does not hand works in.
 */
export function familyMenu(childId: string): NavItem[] {
  const home = `/family/${childId}`;
  return [
    {
      label: CORE_T.nav.home,
      icon: 'tb-i tb-i-home',
      routerLink: home,
      routerLinkActiveOptions: { exact: true },
    },
    {
      label: CORE_T.nav.schedule,
      icon: 'tb-i tb-i-calendar_month',
      routerLink: `${home}/schedule`,
    },
    { label: CORE_T.nav.homework, icon: 'tb-i tb-i-assignment', routerLink: `${home}/homework` },
    {
      label: CORE_T.nav.billing,
      icon: 'tb-i tb-i-account_balance_wallet',
      routerLink: `${home}/billing`,
    },
  ];
}

/**
 * Frame of the family cabinet (`/family/:studentId/**`, ADR-0069): the student's frame with the child
 * switcher and the bell in the top strip. The bell's inbox is the parent's own, of all the children
 * («Петя · …», 454.3); its links lead into the child's pages. Another child rebuilds the frame and its
 * pages, so nothing of the previous child stays on the screen.
 */
@Component({
  selector: 'tb-family-layout',
  imports: [ChildSwitcher, Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (child of shown(); track child) {
      <tb-shell [items]="menu()" [homeLink]="home()">
        <tb-child-switcher [compact]="size() === 'compact'" />
      </tb-shell>
    }
  `,
})
export class FamilyLayout {
  private readonly family = inject(Family);
  protected readonly size = injectWindowSize();

  /**
   * The child of the activated route, not `Family.current`: the guard sets that one before the
   * router leaves the previous child's page, which would read the previous task of another child.
   */
  private readonly childId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('studentId') ?? '')),
    { initialValue: this.family.current() ?? '' },
  );
  /** The child as a one-item list: the frame is built again for another one. */
  protected readonly shown = computed(() => [this.childId()]);
  protected readonly home = computed(() => `/family/${this.childId()}`);
  protected readonly menu = computed(() => familyMenu(this.childId()));
}
