import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { CORE_T } from '@core/i18n/texts';
import { NewMessageState } from '@core/notifications/new-message';
import { CREATE_PARAM, CreateKind } from '@core/routing/create-param';
import { FabMenu, FabMenuItem } from '@shared/ui/fab-menu';

const T = CORE_T.create;

/**
 * What «Создать» makes and the section whose form makes it (spec §4: one home per function); a message to
 * students has no section: its dialog opens over the page (redesign 235.3).
 */
type CreateAction = { readonly label: string; readonly icon: string } & (
  | {
      readonly kind: CreateKind;
      readonly section: string;
      /** More of the address: the tab of the page that has several. */
      readonly query?: Readonly<Record<string, string>>;
    }
  | { readonly kind: 'message' }
);

/** The items of the menu in their usual order. */
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
  {
    kind: 'board',
    label: T.board,
    icon: 'tb-i-co_present',
    section: '/teacher/materials',
    query: { tab: 'boards' },
  },
  {
    kind: 'textbook',
    label: T.textbook,
    icon: 'tb-i-menu_book',
    section: '/teacher/materials',
    query: { tab: 'textbooks' },
  },
  { kind: 'message', label: T.message, icon: 'tb-i-send' },
];

/**
 * The items for the page at `url`: the current section's item first, the others in their order; «Сообщение»
 * calls `message` (it opens the dialog of a new message over the page).
 */
export function createItems(url: string, message: () => void): FabMenuItem[] {
  const path = url.split(/[?#]/)[0] ?? '';
  const search = new URLSearchParams(url.split('#')[0]?.split('?')[1] ?? '');
  const here = CREATE_ACTIONS.filter(
    (action) =>
      'section' in action && (path === action.section || path.startsWith(`${action.section}/`)),
  );
  // a page with tabs (Materials): the item of its open tab, else the first of the section
  const current =
    here.find(
      (action) =>
        'query' in action &&
        Object.entries(action.query ?? {}).every(([key, value]) => search.get(key) === value),
    ) ?? here[0];
  const ordered =
    current === undefined
      ? CREATE_ACTIONS
      : [current, ...CREATE_ACTIONS.filter((action) => action !== current)];
  return ordered.map((action) =>
    'section' in action
      ? {
          label: action.label,
          icon: action.icon,
          link: action.section,
          queryParams: {
            ...(path === action.section && action.kind === 'board'
              ? Object.fromEntries(
                  ['student', 'group'].flatMap((key) => {
                    const value = search.get(key);
                    return value ? [[key, value]] : [];
                  }),
                )
              : {}),
            ...action.query,
            [CREATE_PARAM]: action.kind,
          },
        }
      : { label: action.label, icon: action.icon, run: message },
  );
}

/** {@link createItems} with «Сообщение» opening the frame's dialog; call it in an injection context. */
export function injectCreateItems(): (url: string) => FabMenuItem[] {
  const newMessage = inject(NewMessageState);
  return (url) =>
    createItems(url, () => {
      newMessage.show();
    });
}

/**
 * The teacher's global «Создать» at the top of the rail (ADR-0048, spec §3.1, §4): the small extended FAB in
 * the expanded rail, the FAB in the collapsed one, at elevation 0 as nested in the rail; it opens the FAB
 * menu of six items. An item leads to its section with `?create=<kind>`: the section opens its form and
 * drops the parameter (`openOnCreate`); «Сообщение» opens the dialog of a new message over the page.
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
  private readonly createItems = injectCreateItems();

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
  protected readonly items = computed(() => this.createItems(this.url()));
}
