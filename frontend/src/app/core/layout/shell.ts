import { Avatar } from '@shared/ui/avatar';
import {
  DOCUMENT,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonDirective, ButtonIcon } from 'primeng/button';
import { Drawer } from 'primeng/drawer';
import { Menu } from 'primeng/menu';
import { AuthService } from '@core/auth/auth.service';
import { injectWindowSize } from '@core/layout/mobile';
import { NotificationBell } from '@core/notifications/notification-bell';
import { NewMessage } from '@core/notifications/new-message';
import { NotificationsSheet } from '@core/notifications/notifications-sheet';
import { openOnNotificationsParam } from '@core/notifications/notifications-sheet-state';
import { LANGUAGES, chooseLanguage, language } from '@core/i18n/language';
import { CORE_T } from '@core/i18n/texts';
import { ModalDrawer } from '@shared/ui/modal-drawer';
import { ThemeChoice, ThemeMode } from '@core/theme/theme-mode';
import { CreateMenu } from './create-menu';
import { SideNav } from './side-nav';
import { NavItem, injectUrl, isNavActive } from './nav-item';

const T = CORE_T.shell;

const THEMES: readonly { choice: ThemeChoice; label: string; icon: string }[] = [
  { choice: 'light', label: T.lightTheme, icon: 'tb-i tb-i-light_mode' },
  { choice: 'dark', label: T.darkTheme, icon: 'tb-i tb-i-dark_mode' },
  { choice: 'system', label: T.systemTheme, icon: 'tb-i tb-i-brightness_auto' },
];

/** M3: a navigation bar holds up to five destinations; the others are under ☰ in the modal rail. */
const BAR_ITEMS = 5;

/**
 * Application frame (ADR-0017, ADR-0019, spec §3): the top strip with the bell and the user menu (on compact
 * the top app bar with ☰ and the title of the section before them); the sections of the role in the expanded
 * navigation rail from extra-large, in the collapsed rail from medium to large (ADR-0048, D5) and, on compact,
 * in the bottom navigation with the rest in the modal expanded rail under ☰; the routed content.
 */
/** An item of a choice in a menu (the theme, the language) and the chosen one. */
const CHOICE = 'tb-menu-item--choice';
const CHOSEN = `${CHOICE} tb-menu-item--selected`;

@Component({
  selector: 'tb-shell',
  imports: [
    ButtonDirective,
    ButtonIcon,
    CreateMenu,
    NewMessage,
    Drawer,
    ModalDrawer,
    Menu,
    NotificationBell,
    NotificationsSheet,
    RouterOutlet,
    RouterLink,
    SideNav,
    Avatar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.tb-shell--rail]': '!compact()',
    '[class.tb-shell--wide]': 'size() === "extra-large"',
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
        <span class="tb-shell__title">{{ title() }}</span>
      }
      <div class="tb-shell__user">
        @if (notifications()) {
          <tb-notification-bell />
        }
        <!-- the visible name is the start of the accessible one (WCAG 2.5.3, ADR-0024) -->
        <button
          pButton
          type="button"
          class="tb-shell__user-button tb-shell__user-button--round"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          [attr.aria-label]="t.userMenuOf(userName())"
          aria-haspopup="menu"
          [attr.aria-expanded]="userOpen()"
          (click)="userMenu.toggle($event)"
        >
          @if (userAvatar(); as photo) {
            <tb-avatar class="tb-shell__avatar" [name]="userName()" [photo]="photo" size="2rem" />
          } @else {
            <i
              pButtonIcon
              class="tb-i tb-i-account_circle tb-shell__avatar-icon"
              aria-hidden="true"
            ></i>
          }
        </button>
        <p-menu
          #userMenu
          [model]="userItems()"
          [popup]="true"
          appendTo="body"
          (onShow)="userOpen.set(true); markChoices()"
          (onHide)="userOpen.set(false)"
        />
      </div>
    </header>
    <div class="tb-shell__body">
      @if (!compact()) {
        <tb-side-nav [items]="items()" [footer]="footer()" [rail]="size() !== 'extra-large'">
          @if (create()) {
            <tb-create-menu [extended]="size() === 'extra-large'" />
          }
        </tb-side-nav>
      }
      <main class="tb-shell__content" [class.tb-shell__content--nav]="compact()">
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
      <nav class="tb-bottom-nav" [attr.aria-label]="sections">
        @for (item of barItems(); track item.label) {
          <a
            class="tb-bottom-nav__item"
            [routerLink]="item.routerLink"
            [class.tb-bottom-nav__item--active]="isActive(item)"
            [attr.aria-current]="isActive(item) ? 'page' : null"
          >
            <span class="tb-bottom-nav__icon"><i [class]="item.icon" aria-hidden="true"></i></span>
            <span class="tb-bottom-nav__label">{{ item.label }}</span>
          </a>
        }
      </nav>
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
    }
  `,
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeMode);

  protected readonly t = T;
  protected readonly sections = CORE_T.nav.sections;
  protected readonly close = CORE_T.close;
  protected readonly size = injectWindowSize();
  protected readonly compact = computed(() => this.size() === 'compact');

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
  private readonly document = inject(DOCUMENT);
  protected readonly userOpen = signal(false);
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
      { label: T.account, routerLink: `${home}/account` },
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
  /** The destination of the current page (`isNavActive`). */
  protected isActive(item: NavItem): boolean {
    return isNavActive(item, this.url());
  }
  protected readonly userName = computed(() => this.auth.user()?.displayName ?? '');
  /** The photo of a student or the teacher on the user button; without one, the person icon. */
  protected readonly userAvatar = computed(() => this.auth.user()?.avatar ?? null);
  /**
   * The theme and the language items are radio items of the open menu: the chosen one is checked for
   * screen readers (PrimeNG names an item by its label only, the label says nothing about the choice).
   */
  protected markChoices(): void {
    for (const item of this.document.querySelectorAll(`.p-menu li.${CHOICE}`)) {
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(item.classList.contains('tb-menu-item--selected')));
    }
  }

  /** The bottom group of the rail: the settings of the area and the help (spec §3.2). */
  protected readonly footer = computed<MenuItem[]>(() => [
    ...this.footerLinks(),
    { label: T.help, icon: 'tb-i tb-i-help', routerLink: `${this.homeLink()}/help` },
  ]);

  /** «Мой аккаунт», theme, language, sign out (spec §3.2): the settings and the help are in the rail. */
  protected readonly userItems = computed<MenuItem[]>(() => [
    { label: T.account, icon: 'tb-i tb-i-badge', routerLink: `${this.homeLink()}/account` },
    { separator: true },
    // Flat items: a group (`items`) would turn every top-level item into a group label.
    // the chosen theme: its icon stays, the item is highlighted with a check (ADR-0024); screen
    // readers hear it as a checked radio item (`markChoices`)
    ...THEMES.map(({ choice, label, icon }) => ({
      icon,
      label,
      styleClass: this.theme.choice() === choice ? CHOSEN : CHOICE,
      command: () => {
        this.theme.choose(choice);
      },
    })),
    { separator: true },
    // the language under the theme (ADR-0035): another one reloads the page
    ...LANGUAGES.map(({ code, name }) => ({
      icon: 'tb-i tb-i-translate',
      label: name,
      styleClass: language() === code ? CHOSEN : CHOICE,
      command: () => {
        chooseLanguage(code);
      },
    })),
    { separator: true },
    {
      label: T.signOut,
      icon: 'tb-i tb-i-logout',
      command: () => {
        this.auth.logout().subscribe();
      },
    },
  ]);
}
