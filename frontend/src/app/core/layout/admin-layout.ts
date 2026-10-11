import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { CORE_T } from '@core/i18n/texts';
import { Shell } from './shell';

export const ADMIN_MENU: MenuItem[] = [
  { label: CORE_T.nav.log, icon: 'pi pi-list', routerLink: '/admin/logs' },
  { label: CORE_T.nav.status, icon: 'pi pi-server', routerLink: '/admin/status' },
  { label: CORE_T.nav.events, icon: 'pi pi-sync', routerLink: '/admin/events' },
  { label: CORE_T.nav.integrations, icon: 'pi pi-link', routerLink: '/admin/integrations' },
  { label: CORE_T.nav.backups, icon: 'pi pi-database', routerLink: '/admin/backups' },
  { label: CORE_T.nav.settings, icon: 'pi pi-cog', routerLink: '/admin/settings' },
  { label: CORE_T.nav.diagnostics, icon: 'pi pi-download', routerLink: '/admin/diagnostics' },
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
