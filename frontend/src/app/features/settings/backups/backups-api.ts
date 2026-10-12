import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SKIP_ERROR_TOAST, quietContext } from '@core/http/api-error.interceptor';
import {
  BackupInfo,
  CloudBackup,
  DriveStatus,
  RestoreRequested,
  RestoreStatus,
} from '../data-access/settings.models';

/** Whose backups: the teacher manages them all, the administrator does not download or delete. */
export type BackupsArea = 'teacher' | 'admin';

function base(area: BackupsArea): string {
  return `/api/${area}/backups`;
}

const DRIVE = '/api/teacher/backups/google';

function quiet(): { context: HttpContext } {
  return { context: quietContext() };
}

/** Backups of the teacher and the administrator (ADR-0014). */
@Injectable({ providedIn: 'root' })
export class BackupsApi {
  private readonly http = inject(HttpClient);

  list(area: BackupsArea): Observable<BackupInfo[]> {
    return this.http.get<BackupInfo[]>(base(area), quiet());
  }

  create(area: BackupsArea): Observable<BackupInfo> {
    return this.http.post<BackupInfo>(base(area), null);
  }

  /** The teacher only: the backups hold the students' data. */
  download(name: string): Observable<Blob> {
    return this.http.get(`${base('teacher')}/${encodeURIComponent(name)}`, {
      responseType: 'blob',
    });
  }

  /** The teacher only. */
  delete(name: string): Observable<unknown> {
    return this.http.delete<unknown>(`${base('teacher')}/${encodeURIComponent(name)}`);
  }

  /** Errors are shown in the dialog (a wrong password is not a toast). */
  restore(area: BackupsArea, name: string, password: string): Observable<RestoreRequested> {
    return this.http.post<RestoreRequested>(
      `${base(area)}/${encodeURIComponent(name)}/restore`,
      { password },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  /** Asked again and again while the portal restarts: no toasts when it does not answer. */
  restoreStatus(area: BackupsArea): Observable<RestoreStatus> {
    return this.http.get<RestoreStatus>(`${base(area)}/restore`, quiet());
  }

  /** The teacher's Google Drive for copies of the backups (ADR-0037). */
  driveStatus(): Observable<DriveStatus> {
    return this.http.get<DriveStatus>(DRIVE, quiet());
  }

  saveDriveClient(clientId: string, clientSecret: string): Observable<DriveStatus> {
    return this.http.put<DriveStatus>(`${DRIVE}/client`, { clientId, clientSecret });
  }

  /** The address of Google's consent page. */
  authorizeDrive(origin: string): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${DRIVE}/authorize`, { origin });
  }

  disconnectDrive(): Observable<unknown> {
    return this.http.delete<unknown>(DRIVE);
  }

  /** Backups in the Google Drive, newest first. */
  driveFiles(): Observable<CloudBackup[]> {
    return this.http.get<CloudBackup[]>(`${DRIVE}/files`, quiet());
  }

  /** Sends a backup of the server to the Google Drive in the background. */
  uploadToDrive(name: string): Observable<DriveStatus> {
    return this.http.post<DriveStatus>(`${DRIVE}/uploads/${encodeURIComponent(name)}`, null);
  }

  /** Brings a backup from the Google Drive to the server in the background. */
  downloadFromDrive(id: string): Observable<CloudBackup> {
    return this.http.post<CloudBackup>(`${DRIVE}/files/${encodeURIComponent(id)}/download`, null);
  }
}
