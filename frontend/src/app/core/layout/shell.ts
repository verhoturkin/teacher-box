import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Menubar } from 'primeng/menubar';
import { AuthService } from '@core/auth/auth.service';
import { injectMobile } from '@core/layout/mobile';
import { NotificationBell } from '@core/notifications/notification-bell';
import { Portal } from '@core/portal/portal';
import { PortalLogo } from '@core/portal/portal-logo';
import { ThemeChoice, ThemeMode } from '@core/theme/theme-mode';

const THEMES: readonly { choice: ThemeChoice; label: string; icon: string }[] = [
  { choice: 'light', label: 'Светлая тема', icon: 'pi pi-sun' },
  { choice: 'dark', label: 'Тёмная тема', icon: 'pi pi-moon' },
  { choice: 'system', label: 'Тема как в системе', icon: 'pi pi-desktop' },
];

/** Sections in the bottom navigation; the others are under «Ещё». */
const NAV_ITEMS = 5;

/**
 * Application frame: the header (kept at the top) with the sections and the user menu, the routed
 * content; on a phone the sections move to the bottom navigation.
 */
@Component({
  selector: 'tb-shell',
  imports: [
    Button,
    Menu,
    Menubar,
    NotificationBell,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    PortalLogo,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="tb-shell__header">
      <p-menubar [model]="barItems()" styleClass="tb-shell__bar" breakpoint="1200px">
        <ng-template #start>
          <a class="tb-shell__brand" [routerLink]="homeLink()">
            <tb-portal-logo size="1.5rem" />
            <span>{{ portalName() }}</span>
          </a>
        </ng-template>
        <ng-template #end>
          <div class="tb-shell__user">
            <span class="tb-shell__area">{{ areaTitle() }}</span>
            @if (notifications()) {
              <tb-notification-bell [link]="homeLink() + '/notifications'" />
            }
            <p-button
              [label]="mobile() ? undefined : userName()"
              icon="pi pi-user"
              [text]="true"
              severity="secondary"
              ariaLabel="Меню пользователя"
              (onClick)="userMenu.toggle($event)"
            />
            <p-menu #userMenu [model]="userItems()" [popup]="true" appendTo="body" />
          </div>
        </ng-template>
      </p-menubar>
    </header>
    <main class="tb-shell__content" [class.tb-shell__content--nav]="mobile()">
      <router-outlet />
    </main>
    @if (mobile()) {
      <nav class="tb-bottom-nav" aria-label="Разделы">
        @for (item of navItems(); track item.label) {
          <a
            class="tb-bottom-nav__item"
            [routerLink]="item.routerLink"
            routerLinkActive="tb-bottom-nav__item--active"
            [routerLinkActiveOptions]="item.routerLinkActiveOptions ?? { exact: false }"
          >
            <i [class]="item.icon" aria-hidden="true"></i>
            <span>{{ item.label }}</span>
          </a>
        }
        @if (moreItems().length > 0) {
          <button
            type="button"
            class="tb-bottom-nav__item"
            aria-label="Ещё разделы"
            (click)="moreMenu.toggle($event)"
          >
            <i class="pi pi-ellipsis-h" aria-hidden="true"></i>
            <span>Ещё</span>
          </button>
        }
      </nav>
      <!-- Outside the navigation: in its grid the menu would take a column of its own. -->
      <p-menu #moreMenu [model]="moreItems()" [popup]="true" appendTo="body" />
    }
  `,
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeMode);

  protected readonly portalName = inject(Portal).name;
  protected readonly mobile = injectMobile();

  readonly items = input.required<MenuItem[]>();
  readonly homeLink = input.required<string>();
  readonly areaTitle = input.required<string>();
  /** Links shown in the user menu before «Мой аккаунт» (e.g. the teacher's settings). */
  readonly userLinks = input<MenuItem[]>([]);
  /** The notification bell (the administrator has no notifications). */
  readonly notifications = input(true);

  /** On a phone the header keeps only the logo, the bell and the user menu. */
  protected readonly barItems = computed(() => (this.mobile() ? [] : this.items()));
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
