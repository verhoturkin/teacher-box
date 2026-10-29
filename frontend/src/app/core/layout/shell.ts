import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Menu } from 'primeng/menu';
import { injectWindowSize } from '@core/layout/mobile';
import { NotificationBell } from '@core/notifications/notification-bell';
import { NewMessage } from '@core/notifications/new-message';
import { NotificationsSheet } from '@core/notifications/notifications-sheet';
import { openOnNotificationsParam } from '@core/notifications/notifications-sheet-state';
import { CORE_T } from '@core/i18n/texts';
import { GlobalSearchView } from '@core/search/global-search-view';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { CreateMenu } from './create-menu';
import { NavBadge } from './nav-badge';
import { SideNav } from './side-nav';
import { NavItem, injectUrl, isNavActive } from './nav-item';
import { RailState } from './rail-state';

const T = CORE_T.shell;

/** M3: a navigation bar holds up to five destinations; the others are under ☰ in the modal rail. */
const BAR_ITEMS = 5;

/**
 * Application frame (ADR-0017, ADR-0019, spec §3): the top strip with the bell (on compact
 * the top app bar with ☰ and the title of the section before them); the sections of the role in the expanded
 * navigation rail from extra-large, in the collapsed rail from medium to large (ADR-0048, D5) and, on compact,
 * in the bottom navigation with the rest in the modal expanded rail under ☰; the routed content.
 */
@Component({
  selector: 'tb-shell',
  imports: [
    ButtonDirective,
    ButtonIcon,
    CreateMenu,
    GlobalSearchView,
    NavBadge,
    NewMessage,
    Drawer,
    ModalDrawer,
    Menu,
    NotificationBell,
    NotificationsSheet,
    RouterOutlet,
    RouterLink,
    SideNav,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tb-shell--rail]': '!compact()',
    '[class.tb-shell--wide]': 'expanded()',
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    <header class="tb-shell__header">
      @if (compact()) {
        <!-- M3 small top app bar: ☰ opens the modal expanded rail, the title names the section -->
        <button
          pButton
          type="button"
          class="tb-shell__rail-button"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          [attr.aria-label]="sections"
          aria-haspopup="dialog"
          [attr.aria-expanded]="railOpen()"
          (click)="railOpen.set(true)"
        >
          <i pButtonIcon class="tb-i tb-i-menu" aria-hidden="true"></i>
        </button>
        <span class="tb-shell__title">{{ pageBar()?.title ?? title() }}</span>
        @if (search()) {
          <button
            pButton
            type="button"
            class="tb-shell__user-button--round"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [attr.aria-label]="searchLabel"
            aria-haspopup="dialog"
            (click)="searchOpen.set(true)"
          >
            <i pButtonIcon class="tb-i tb-i-search" aria-hidden="true"></i>
          </button>
        }
      } @else if (search()) {
        <!-- the M3 search bar of the top strip (spec §3.2, 248.2) -->
        <tb-global-search />
      }
      @if (pageBar(); as bar) {
        <!-- the page's own actions in place of the bell and the account (spec §10.2) -->
        <div class="tb-shell__user">
          @for (action of bar.actions; track action.label) {
            <button
              pButton
              type="button"
              class="tb-shell__user-button--round"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [attr.aria-label]="action.label"
              [disabled]="action.disabled ?? false"
              (click)="action.command()"
            >
              <i pButtonIcon class="tb-i tb-i-{{ action.icon }}" aria-hidden="true"></i>
            </button>
          }
          @if (bar.menu.length > 0) {
            <button
              pButton
              type="button"
              class="tb-shell__user-button--round"
              [text]="true"
              [rounded]="true"
              severity="secondary"
              [attr.aria-label]="bar.menuLabel"
              aria-haspopup="menu"
              (click)="pageMenu.toggle($event)"
            >
              <i pButtonIcon class="tb-i tb-i-more_vert" aria-hidden="true"></i>
            </button>
            <p-menu #pageMenu [model]="bar.menu" [popup]="true" appendTo="body" />
          }
        </div>
      } @else {
        <div class="tb-shell__user">
          @if (notifications()) {
            <tb-notification-bell />
          }
        </div>
      }
    </header>
    <div class="tb-shell__body">
      @if (!compact()) {
        <tb-side-nav [items]="items()" [footer]="footer()" [rail]="!expanded()">
          @if (create()) {
            <tb-create-menu [extended]="expanded()" />
          }
        </tb-side-nav>
      }
      <main class="tb-shell__content" [class.tb-shell__content--nav]="bar()">
        <router-outlet />
      </main>
      @if (notifications()) {
        <!-- the bell's sheet: the third pane on extra-large, the modal side sheet below (spec §10.3) -->
        <tb-notifications-sheet [docked]="size() === 'extra-large'" />
      }
      @if (create()) {
        <!-- «Создать › Сообщение» on any page, the rail's or the phone's home FAB menu -->
        <tb-new-message />
      }
    </div>
    @if (compact()) {
      @if (bar()) {
        <nav class="tb-bottom-nav" [attr.aria-label]="sections">
          @for (item of barItems(); track item.label) {
            <a
              class="tb-bottom-nav__item"
              [routerLink]="item.routerLink"
              [class.tb-bottom-nav__item--active]="isActive(item)"
              [attr.aria-current]="isActive(item) ? 'page' : null"
            >
              <span class="tb-bottom-nav__icon"
                ><i [class]="item.icon" aria-hidden="true"></i>
                @if (item.count; as badge) {
                  @if (badge() > 0) {
                    <tb-nav-badge [count]="badge()" />
                  }
                }
              </span>
              @if (item.count; as badge) {
                @if (badge() > 0 && item.countLabel; as label) {
                  <span class="tb-sr-only">{{ label(badge()) }}</span>
                }
              }
              <span class="tb-bottom-nav__label">{{ item.label }}</span>
            </a>
          }
        </nav>
      }
      <!-- the modal expanded rail (M3E): the scrim, the focus trap and the focus back to ☰ come with
           tbModalDrawer; Esc in the rail closes it as the drawer's own Esc does -->
      <p-drawer
        #rail
        tbModalDrawer
        [(visible)]="railOpen"
        position="left"
        appendTo="body"
        [blockScroll]="true"
        [closable]="false"
        styleClass="tb-modal-rail"
      >
        <ng-template #header>
          <button
            pButton
            type="button"
            class="tb-modal-rail__close"
            [text]="true"
            [rounded]="true"
            severity="secondary"
            [attr.aria-label]="close"
            (click)="rail.close($event)"
          >
            <i pButtonIcon class="tb-i tb-i-menu_open" aria-hidden="true"></i>
          </button>
          <span class="p-drawer-title tb-sr-only">{{ sections }}</span>
        </ng-template>
        <tb-side-nav
          [items]="railItems()"
          [footer]="footer()"
          [modal]="true"
          (navigate)="railOpen.set(false)"
          (keydown.escape)="rail.close($event)"
        />
      </p-drawer>
      @if (search()) {
        <tb-global-search [full]="true" [(open)]="searchOpen" />
      }
    }
  `,
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly t = T;
  protected readonly sections = CORE_T.nav.sections;
  protected readonly close = CORE_T.close;
  protected readonly size = injectWindowSize();
  protected readonly compact = computed(() => this.size() === 'compact');
  private readonly railState = inject(RailState);
  /** The top app bar the page asks for (compact only). */
  protected readonly pageBar = computed(() =>
    this.compact() ? this.railState.compactBar() : null,
  );
  /** The bottom navigation bar: a phone's, unless the page hides it (the review of a work, spec §9). */
  protected readonly bar = computed(() => this.compact() && !this.railState.bottomBarHidden());
  /** The expanded rail: extra-large, unless the page collapses it (the review of a work, spec §9). */
  protected readonly expanded = computed(
    () => this.size() === 'extra-large' && !this.railState.collapsed(),
  );

  constructor() {
    // `?notifications=…` (old links to the notifications page) opens the bell's sheet
    openOnNotificationsParam();
  }

  readonly items = input.required<NavItem[]>();
  readonly homeLink = input.required<string>();
  /** Links at the bottom of the rail before «Справка» (the settings of the area). */
  readonly footerLinks = input<NavItem[]>([]);
  /**
   * «Создать» at the top of the rail (the teacher only, ADR-0048); on compact the sections keep their own
   * create actions (spec §3.1).
   */
  readonly create = input(false);
  /** The global search of the top strip and Ctrl K (the teacher only, redesign spec §2, D6). */
  readonly search = input(false);
  /** The notification bell (the administrator has no notifications). */
  readonly notifications = input(true);
  /**
   * Links of the sections of the bottom bar on a phone, in this order; up to five, filled up with the
   * other sections in the order of `items` (the rail keeps the order of `items`).
   */
  readonly bottomNav = input<readonly string[]>([]);

  /** The sections of the bottom bar (M3: up to five destinations, spec §5). */
  protected readonly barItems = computed(() => {
    const items = this.items();
    const first = this.bottomNav()
      .map((link) => items.find((item) => item.routerLink === link))
      .filter((item): item is NavItem => item !== undefined);
    return [...first, ...items.filter((item) => !first.includes(item))].slice(0, BAR_ITEMS);
  });
  /** The other sections: in the modal expanded rail under ☰, in the order of the rail. */
  protected readonly railItems = computed(() =>
    this.items().filter((item) => !this.barItems().includes(item)),
  );
  /** The modal expanded rail is open (compact only). */
  protected readonly railOpen = signal(false);
  /** The full-screen search view is open (compact only). */
  protected readonly searchOpen = signal(false);
  protected readonly searchLabel = CORE_T.search.open;
  private readonly searchBar = viewChild(GlobalSearchView);
  private readonly url = injectUrl();
  /**
   * The title of the top app bar on compact (spec §3.2): the destination the page belongs to — the longest
   * link of the sections, the bottom group and «Мой аккаунт» that leads the address.
   */
  protected readonly title = computed(() => {
    const url = this.url().split(/[?#]/)[0] ?? '';
    const home = this.homeLink();
    const destinations: MenuItem[] = [
      ...this.items().flatMap((item) => [
        item,
        ...(item.alsoActive ?? []).map((link) => ({ label: item.label, routerLink: link })),
      ]),
      ...this.footer(),
    ];
    let best = { label: '', length: 0 };
    for (const item of destinations) {
      const link: unknown = item.routerLink;
      if (
        typeof link === 'string' &&
        (url === link || (link !== home && url.startsWith(`${link}/`))) &&
        link.length > best.length
      ) {
        best = { label: item.label ?? '', length: link.length };
      }
    }
    return best.label;
  });
  /** Ctrl K / ⌘ K: the search bar takes the focus, on compact the full-screen search opens. */
  protected onKeydown(event: KeyboardEvent): void {
    if (
      this.search() &&
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === 'k'
    ) {
      event.preventDefault();
      if (this.compact()) {
        this.searchOpen.set(true);
      } else {
        this.searchBar()?.focus();
      }
    }
  }

  /** The destination of the current page (`isNavActive`). */
  protected isActive(item: NavItem): boolean {
    return isNavActive(item, this.url());
  }
  /** The teacher's account is a category of the settings; the others have a page of their own. */
  private readonly accountLink = computed(() => {
    const home = this.homeLink();
    return home === '/teacher' ? '/teacher/settings/account' : `${home}/account`;
  });

  /** The bottom group of the rail: the settings of the area, the help, the account (spec §3.2). */
  protected readonly footer = computed<MenuItem[]>(() => [
    ...this.footerLinks(),
    { label: T.help, icon: 'tb-i tb-i-help', routerLink: `${this.homeLink()}/help` },
    { label: T.account, account: true, routerLink: this.accountLink() },
  ]);
}
