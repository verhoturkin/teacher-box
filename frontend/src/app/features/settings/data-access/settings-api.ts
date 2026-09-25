import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BackupInfo, NotificationsStatus } from './settings.models';

/** Instance settings of the teacher: backups and integration status. */
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

  notificationsStatus(): Observable<NotificationsStatus> {
    return this.http.get<NotificationsStatus>('/api/teacher/notifications/status');
  }
}
