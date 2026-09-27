import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PortalSettings } from '@core/portal/portal';
import { NotificationsStatus } from './settings.models';

/** Instance settings of the teacher: the portal and the integration status. */
@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly http = inject(HttpClient);

  portal(): Observable<PortalSettings> {
    return this.http.get<PortalSettings>('/api/teacher/portal');
  }

  /** Empty values mean the default name and no address. */
  changePortal(name: string, address: string): Observable<PortalSettings> {
    return this.http.put<PortalSettings>('/api/teacher/portal', { name, address });
  }

  /** The first setup is finished or skipped. */
  completeSetup(): Observable<PortalSettings> {
    return this.http.post<PortalSettings>('/api/teacher/portal/setup', null);
  }

  notificationsStatus(): Observable<NotificationsStatus> {
    return this.http.get<NotificationsStatus>('/api/teacher/notifications/status');
  }
}
