import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Shell } from './shell';

export const ADMIN_MENU: MenuItem[] = [
  { label: 'Журнал', icon: 'pi pi-list', routerLink: '/admin/logs' },
  { label: 'Состояние', icon: 'pi pi-server', routerLink: '/admin/status' },
  { label: 'События', icon: 'pi pi-sync', routerLink: '/admin/events' },
  { label: 'Интеграции', icon: 'pi pi-link', routerLink: '/admin/integrations' },
  { label: 'Диагностика', icon: 'pi pi-download', routerLink: '/admin/diagnostics' },
];

/** Frame of the administrator area (`/admin/**`). */
@Component({
  selector: 'tb-admin-layout',
  imports: [Shell],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<tb-shell [items]="menu" homeLink="/admin" areaTitle="Администрирование" [notifications]="false" />`,
})
export class AdminLayout {
  protected readonly menu = ADMIN_MENU;
}
