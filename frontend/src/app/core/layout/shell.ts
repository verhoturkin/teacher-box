import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
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

/** Sections in the bottom navigation; the others are under «Ещё». */
const NAV_ITEMS = 5;

/**
 * Application frame (ADR-0017, ADR-0019): the top app bar (kept at the top) with the portal, the
 * bell and the user menu; the sections of the role in the expanded navigation rail on a wide
 * screen, in the rail on a tablet and in the bottom navigation on a phone; the routed content.
 */
@Component({
  selector: 'tb-shell',
  imports: [
    Button,
    Menu,
    NotificationBell,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    PortalLogo,
    SideNav,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="tb-shell__header">
      <a class="tb-shell__brand" [routerLink]="homeLink()">
        <tb-portal-logo size="1.75rem" />
        <span>{{ portalName() }}</span>
      </a>
      <div class="tb-shell__user">
        @if (notifications()) {
          <tb-notification-bell [link]="homeLink() + '/notifications'" />
        }
        <p-button
          [label]="compact() ? undefined : userName()"
          icon="pi pi-user"
          [text]="true"
          [rounded]="true"
          severity="secondary"
          ariaLabel="Меню пользователя"
          (onClick)="userMenu.toggle($event)"
        />
        <p-menu #userMenu [model]="userItems()" [popup]="true" appendTo="body" />
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
            [routerLinkActiveOptions]="item.routerLinkActiveOptions ?? { exact: false }"
          >
            <span class="tb-bottom-nav__icon"><i [class]="item.icon" aria-hidden="true"></i></span>
            <span class="tb-bottom-nav__label">{{ item.label }}</span>
          </a>
        }
        @if (moreItems().length > 0) {
          <button
            type="button"
            class="tb-bottom-nav__item"
            aria-label="Ещё разделы"
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
  protected readonly moreItems = computed(() => this.items().slice(NAV_ITEMS));
  protected readonly userName = computed(() => this.auth.user()?.displayName ?? '');
  protected readonly userItems = computed<MenuItem[]>(() => [
    ...this.userLinks(),
    { label: 'Справка', icon: 'pi pi-question-circle', routerLink: `${this.homeLink()}/help` },
    { label: 'Мой аккаунт', icon: 'pi pi-id-card', routerLink: `${this.homeLink()}/account` },
    { separator: true },
    // Flat items: a group (`items`) would turn every top-level item into a group label.
    ...THEMES.map(({ choice, label, icon }) => ({
      label,
      icon: this.theme.choice() === choice ? 'pi pi-check' : icon,
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
