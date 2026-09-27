import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { PortalSettings } from '@core/portal/portal';
import { NotificationsStatus, ResetResult } from './settings.models';

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

  /** Deletes all data after a backup; a wrong password is shown in the dialog. */
  reset(password: string): Observable<ResetResult> {
    return this.http.post<ResetResult>(
      '/api/teacher/reset',
      { password },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  notificationsStatus(): Observable<NotificationsStatus> {
    return this.http.get<NotificationsStatus>('/api/teacher/notifications/status');
  }
}
