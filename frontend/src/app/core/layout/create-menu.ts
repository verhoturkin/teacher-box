import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { CORE_T } from '@core/i18n/texts';
import { CREATE_PARAM, CreateKind } from '@core/routing/create-param';
import { FabMenu, FabMenuItem } from '@shared/ui/fab-menu';

const T = CORE_T.create;

/** What «Создать» makes and the section whose form makes it (spec §4: one home per function). */
interface CreateAction {
  readonly kind: CreateKind;
  readonly label: string;
  readonly icon: string;
  readonly section: string;
}

/** The six items of the menu (M3 FAB menu: up to six) in their usual order. */
export const CREATE_ACTIONS: readonly CreateAction[] = [
  { kind: 'lesson', label: T.lesson, icon: 'tb-i-calendar_add_on', section: '/teacher/schedule' },
  {
    kind: 'assignment',
    label: T.assignment,
    icon: 'tb-i-assignment_add',
    section: '/teacher/homework',
  },
  {
    kind: 'payment',
    label: T.payment,
    icon: 'tb-i-account_balance_wallet',
    section: '/teacher/billing',
  },
  { kind: 'student', label: T.student, icon: 'tb-i-person_add', section: '/teacher/students' },
  { kind: 'board', label: T.board, icon: 'tb-i-co_present', section: '/teacher/boards' },
  {
    kind: 'message',
    label: T.message,
    icon: 'tb-i-send',
    section: '/teacher/notifications',
  },
];

/** The items for the page at `url`: the current section's item first, the others in their order. */
export function createItems(url: string): FabMenuItem[] {
  const path = url.split(/[?#]/)[0] ?? '';
  const current = CREATE_ACTIONS.find(
    (action) => path === action.section || path.startsWith(`${action.section}/`),
  );
  const ordered =
    current === undefined
      ? CREATE_ACTIONS
      : [current, ...CREATE_ACTIONS.filter((action) => action !== current)];
  return ordered.map((action) => ({
    label: action.label,
    icon: action.icon,
    link: action.section,
    queryParams: { [CREATE_PARAM]: action.kind },
  }));
}

/**
 * The teacher's global «Создать» at the top of the rail (ADR-0048, spec §3.1, §4): the small extended FAB in
 * the expanded rail, the FAB in the collapsed one, at elevation 0 as nested in the rail; it opens the FAB
 * menu of six items. An item leads to its section with `?create=<kind>`: the section opens its form and
 * drops the parameter (`openOnCreate`).
 */
@Component({
  selector: 'tb-create-menu',
  imports: [FabMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.tb-create-menu--rail]': '!extended()' },
  template: `<tb-fab-menu
    [items]="items()"
    [label]="label"
    [variant]="extended() ? 'extended' : 'rail'"
  />`,
  styles: `
    :host {
      display: flex;
      flex: none;
      /* ours: 16 px between «Создать» and the destinations */
      margin-bottom: var(--tb-space-4);
    }

    /* the FAB in the middle of the 96 px rail, over the destinations */
    :host(.tb-create-menu--rail) {
      justify-content: center;
    }
  `,
})
export class CreateMenu {
  private readonly router = inject(Router);

  /** The small extended FAB (the expanded rail) instead of the FAB (the collapsed one). */
  readonly extended = input(false);

  protected readonly label = T.title;
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly items = computed(() => createItems(this.url()));
}
