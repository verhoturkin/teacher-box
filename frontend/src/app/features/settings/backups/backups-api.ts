import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { BackupInfo, RestoreRequested, RestoreStatus } from '../data-access/settings.models';

/** Whose backups: the teacher manages them all, the administrator does not download or delete. */
export type BackupsArea = 'teacher' | 'admin';

function base(area: BackupsArea): string {
  return `/api/${area}/backups`;
}

/** Backups of the teacher and the administrator (ADR-0014). */
@Injectable({ providedIn: 'root' })
export class BackupsApi {
  private readonly http = inject(HttpClient);

  list(area: BackupsArea): Observable<BackupInfo[]> {
    return this.http.get<BackupInfo[]>(base(area));
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
    return this.http.get<RestoreStatus>(`${base(area)}/restore`, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
