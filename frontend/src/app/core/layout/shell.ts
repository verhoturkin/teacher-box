import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { Button } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { Menubar } from 'primeng/menubar';
import { AuthService } from '@core/auth/auth.service';
import { NotificationBell } from '@core/notifications/notification-bell';

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
          <span>Teacher Box</span>
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
    { label: 'Мой аккаунт', icon: 'pi pi-id-card', routerLink: `${this.homeLink()}/account` },
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
