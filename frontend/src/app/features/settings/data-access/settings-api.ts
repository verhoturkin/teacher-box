import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PortalSettings } from '@core/portal/portal';
import { BackupInfo, NotificationsStatus } from './settings.models';

/** Instance settings of the teacher: the portal, backups and integration status. */
@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly http = inject(HttpClient);

  backups(): Observable<BackupInfo[]> {
    return this.http.get<BackupInfo[]>('/api/teacher/backups');
  }

  createBackup(): Observable<BackupInfo> {
    return this.http.post<BackupInfo>('/api/teacher/backups', null);
  }

  downloadBackup(name: string): Observable<Blob> {
    return this.http.get(`/api/teacher/backups/${encodeURIComponent(name)}`, { responseType: 'blob' });
  }

  deleteBackup(name: string): Observable<unknown> {
    return this.http.delete<unknown>(`/api/teacher/backups/${encodeURIComponent(name)}`);
  }

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
