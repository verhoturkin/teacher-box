import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MenuItem } from 'primeng/api';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { AuthService } from '@core/auth/auth.service';
import { injectWindowSize } from '@core/layout/mobile';
import { NotificationBell } from '@core/notifications/notification-bell';
import { Portal } from '@core/portal/portal';
import { PortalLogo } from '@core/portal/portal-logo';
import { ThemeChoice, ThemeMode } from '@core/theme/theme-mode';
import { SideNav } from './side-nav';

const THEMES: readonly { choice: ThemeChoice; label: string; icon: string }[] = [
  { choice: 'light', label: 'Светлая тема', icon: 'pi pi-sun' },
  { choice: 'dark', label: 'Тёмная тема', icon: 'pi pi-moon' },
  { choice: 'system', label: 'Тема как в системе', icon: 'pi pi-desktop' },
];

/** Sections in the bottom navigation: four and «Ещё» (ADR-0027); the others are under «Ещё». */
const NAV_ITEMS = 4;

/**
 * Application frame (ADR-0017, ADR-0019): the top app bar (kept at the top) with the portal, the
 * bell and the user menu; the sections of the role in the expanded navigation rail on a wide
 * screen, in the rail on a tablet and in the bottom navigation on a phone; the routed content.
 */
@Component({
  selector: 'tb-shell',
  imports: [
    ButtonDirective,
    ButtonIcon,
    ButtonLabel,
    Menu,
    NotificationBell,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    PortalLogo,
    SideNav,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:scroll)': 'onScroll()' },
  template: `
    <header class="tb-shell__header" [class.tb-shell__header--scrolled]="scrolled()">
      <a class="tb-shell__brand" [routerLink]="homeLink()">
        <tb-portal-logo size="1.75rem" />
        <span>{{ portalName() }}</span>
      </a>
      <div class="tb-shell__user">
        @if (notifications()) {
          <tb-notification-bell [link]="homeLink() + '/notifications'" />
        }
        <!-- the visible name is the start of the accessible one (WCAG 2.5.3, ADR-0024) -->
        <button
          pButton
          type="button"
          class="tb-shell__user-button"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          [attr.aria-label]="compact() ? 'Меню пользователя' : userName() + ': меню пользователя'"
          aria-haspopup="menu"
          [attr.aria-expanded]="userOpen()"
          (click)="userMenu.toggle($event)"
        >
          <i pButtonIcon class="pi pi-user" aria-hidden="true"></i>
          @if (!compact()) {
            <span pButtonLabel>{{ userName() }}</span>
          }
        </button>
        <p-menu
          #userMenu
          [model]="userItems()"
          [popup]="true"
          appendTo="body"
          (onShow)="userOpen.set(true)"
          (onHide)="userOpen.set(false)"
        />
      </div>
    </header>
    <div class="tb-shell__body">
      @if (!compact()) {
        <tb-side-nav [items]="items()" [rail]="size() === 'medium'" />
      }
      <main class="tb-shell__content" [class.tb-shell__content--nav]="compact()">
        <router-outlet />
      </main>
    </div>
    @if (compact()) {
      <nav class="tb-bottom-nav" aria-label="Разделы">
        @for (item of navItems(); track item.label) {
          <a
            class="tb-bottom-nav__item"
            [routerLink]="item.routerLink"
            routerLinkActive="tb-bottom-nav__item--active"
            ariaCurrentWhenActive="page"
            [routerLinkActiveOptions]="item.routerLinkActiveOptions ?? { exact: false }"
          >
            <span class="tb-bottom-nav__icon"><i [class]="item.icon" aria-hidden="true"></i></span>
            <span class="tb-bottom-nav__label">{{ item.label }}</span>
          </a>
        }
        @if (moreItems().length > 0) {
          <!-- a section from «Ещё» marks «Ещё» (ADR-0024) -->
          <button
            type="button"
            class="tb-bottom-nav__item"
            [class.tb-bottom-nav__item--active]="moreActive()"
            aria-label="Ещё разделы"
            aria-haspopup="menu"
            [attr.aria-expanded]="moreOpen()"
            [attr.aria-current]="moreActive() ? 'page' : null"
            (click)="moreMenu.toggle($event)"
          >
            <span class="tb-bottom-nav__icon"
              ><i class="pi pi-ellipsis-h" aria-hidden="true"></i
            ></span>
            <span class="tb-bottom-nav__label">Ещё</span>
          </button>
        }
      </nav>
      <!-- Outside the navigation: in its grid the menu would take a column of its own. -->
      <p-menu
        #moreMenu
        [model]="moreItems()"
        [popup]="true"
        appendTo="body"
        styleClass="tb-more-menu"
        (onShow)="moreOpen.set(true)"
        (onHide)="moreOpen.set(false)"
      />
    }
  `,
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeMode);

  protected readonly portalName = inject(Portal).name;
  protected readonly size = injectWindowSize();
  protected readonly compact = computed(() => this.size() === 'compact');

  readonly items = input.required<MenuItem[]>();
  readonly homeLink = input.required<string>();
  /** Links shown in the user menu before «Мой аккаунт» (e.g. the teacher's settings). */
  readonly userLinks = input<MenuItem[]>([]);
  /** The notification bell (the administrator has no notifications). */
  readonly notifications = input(true);

  protected readonly navItems = computed(() => this.items().slice(0, NAV_ITEMS));
  /** The page is scrolled: the top bar rises (M3 top app bar on scroll). */
  protected readonly scrolled = signal(false);
  protected readonly userOpen = signal(false);
  protected readonly moreOpen = signal(false);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** The sections under «Ещё»; the current one is chosen in the menu (ADR-0027, ADR-0022). */
  protected readonly moreItems = computed<MenuItem[]>(() => {
    const url = this.url().split(/[?#]/)[0] ?? '';
    return this.items()
      .slice(NAV_ITEMS)
      .map((item) => {
        const link: unknown = item.routerLink;
        const current = typeof link === 'string' && (url === link || url.startsWith(`${link}/`));
        return current ? { ...item, styleClass: 'tb-menu-item--selected' } : item;
      });
  });
  /** The current page is a section from «Ещё». */
  protected readonly moreActive = computed(() =>
    this.moreItems().some((item) => item.styleClass === 'tb-menu-item--selected'),
  );
  protected onScroll(): void {
    this.scrolled.set(window.scrollY > 0);
  }

  protected readonly userName = computed(() => this.auth.user()?.displayName ?? '');
  protected readonly userItems = computed<MenuItem[]>(() => [
    ...this.userLinks(),
    { label: 'Справка', icon: 'pi pi-question-circle', routerLink: `${this.homeLink()}/help` },
    { label: 'Мой аккаунт', icon: 'pi pi-id-card', routerLink: `${this.homeLink()}/account` },
    { separator: true },
    // Flat items: a group (`items`) would turn every top-level item into a group label.
    // the chosen theme: its icon stays, the item is highlighted and says that it is chosen (ADR-0024)
    ...THEMES.map(({ choice, label, icon }) => ({
      icon,
      ...(this.theme.choice() === choice
        ? { label: `${label} (выбрана)`, styleClass: 'tb-menu-item--selected' }
        : { label }),
      command: () => {
        this.theme.choose(choice);
      },
    })),
    { separator: true },
    {
      label: 'Выйти',
      icon: 'pi pi-sign-out',
      command: () => {
        this.auth.logout().subscribe();
      },
    },
  ]);
}
