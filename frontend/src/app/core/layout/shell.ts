import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Menubar } from 'primeng/menubar';
import { AuthService } from '@core/auth/auth.service';
import { NotificationBell } from '@core/notifications/notification-bell';
import { Portal } from '@core/portal/portal';
import { ThemeChoice, ThemeMode } from '@core/theme/theme-mode';

const THEMES: readonly { choice: ThemeChoice; label: string; icon: string }[] = [
  { choice: 'light', label: 'Светлая тема', icon: 'pi pi-sun' },
  { choice: 'dark', label: 'Тёмная тема', icon: 'pi pi-moon' },
  { choice: 'system', label: 'Тема как в системе', icon: 'pi pi-desktop' },
];

/** Application frame: navigation bar with the user menu and routed content. */
@Component({
  selector: 'tb-shell',
  imports: [Button, Menu, Menubar, NotificationBell, RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-menubar [model]="items()" styleClass="tb-shell__bar" breakpoint="1200px">
      <ng-template #start>
        <a class="tb-shell__brand" [routerLink]="homeLink()">
          <i class="pi pi-graduation-cap" aria-hidden="true"></i>
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
            [label]="userName()"
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
    <main class="tb-shell__content">
      <router-outlet />
    </main>
  `,
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeMode);

  protected readonly portalName = inject(Portal).name;

  readonly items = input.required<MenuItem[]>();
  readonly homeLink = input.required<string>();
  readonly areaTitle = input.required<string>();
  /** Links shown in the user menu before «Мой аккаунт» (e.g. the teacher's settings). */
  readonly userLinks = input<MenuItem[]>([]);
  /** The notification bell (the administrator has no notifications). */
  readonly notifications = input(true);

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
