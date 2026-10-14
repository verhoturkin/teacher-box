import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { CORE_T } from '@core/i18n/texts';
import { Shell } from './shell';

export const ADMIN_MENU: MenuItem[] = [
  { label: CORE_T.nav.log, icon: 'tb-i tb-i-list_alt', routerLink: '/admin/logs' },
  { label: CORE_T.nav.status, icon: 'tb-i tb-i-dns', routerLink: '/admin/status' },
  { label: CORE_T.nav.events, icon: 'tb-i tb-i-sync', routerLink: '/admin/events' },
  { label: CORE_T.nav.integrations, icon: 'tb-i tb-i-link', routerLink: '/admin/integrations' },
  { label: CORE_T.nav.backups, icon: 'tb-i tb-i-database', routerLink: '/admin/backups' },
  { label: CORE_T.nav.settings, icon: 'tb-i tb-i-settings', routerLink: '/admin/settings' },
  { label: CORE_T.nav.diagnostics, icon: 'tb-i tb-i-download', routerLink: '/admin/diagnostics' },
];

/** Frame of the administrator area (`/admin/**`). */
@Component({
  selector: 'tb-admin-layout',
  imports: [Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-shell [items]="menu" homeLink="/admin" [notifications]="false" />`,
})
export class AdminLayout {
  protected readonly menu = ADMIN_MENU;
}
