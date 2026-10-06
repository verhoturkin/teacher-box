import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthResponse } from '@core/auth/auth.models';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import {
  Account,
  CreatedStudent,
  GroupInput,
  InviteInfo,
  IssuedInvite,
  Student,
  StudentGroup,
  StudentProfileInput,
} from './identity.models';

/** HTTP client of the identity module. */
@Injectable({ providedIn: 'root' })
export class IdentityApi {
  private readonly http = inject(HttpClient);

  /** @param context `quietContext()` when the page shows a failed load itself (ADR-0025) */
  listStudents(context?: HttpContext): Observable<Student[]> {
    return this.http.get<Student[]>('/api/teacher/students', { context });
  }

  createStudent(profile: StudentProfileInput): Observable<CreatedStudent> {
    return this.http.post<CreatedStudent>('/api/teacher/students', profile);
  }

  updateStudent(id: string, profile: StudentProfileInput, version: number): Observable<Student> {
    return this.http.put<Student>(`/api/teacher/students/${id}`, { ...profile, version });
  }

  reissueInvite(id: string): Observable<IssuedInvite> {
    return this.http.post<IssuedInvite>(`/api/teacher/students/${id}/invite`, null);
  }

  deactivate(id: string): Observable<Student> {
    return this.http.post<Student>(`/api/teacher/students/${id}/deactivate`, null);
  }

  reactivate(id: string): Observable<Student> {
    return this.http.post<Student>(`/api/teacher/students/${id}/reactivate`, null);
  }

  /** @param context `quietContext()` when the page shows a failed load itself (ADR-0025) */
  listGroups(context?: HttpContext): Observable<StudentGroup[]> {
    return this.http.get<StudentGroup[]>('/api/teacher/groups', { context });
  }

  createGroup(group: GroupInput): Observable<StudentGroup> {
    return this.http.post<StudentGroup>('/api/teacher/groups', group);
  }

  updateGroup(id: string, group: GroupInput, version: number): Observable<StudentGroup> {
    return this.http.put<StudentGroup>(`/api/teacher/groups/${id}`, { ...group, version });
  }

  archiveGroup(id: string): Observable<StudentGroup> {
    return this.http.post<StudentGroup>(`/api/teacher/groups/${id}/archive`, null);
  }

  restoreGroup(id: string): Observable<StudentGroup> {
    return this.http.post<StudentGroup>(`/api/teacher/groups/${id}/restore`, null);
  }

  /** Invitation errors are shown on the page itself. */
  describeInvite(token: string): Observable<InviteInfo> {
    return this.http.get<InviteInfo>(`/api/auth/invites/${encodeURIComponent(token)}`, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  acceptInvite(token: string, login: string | null, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `/api/auth/invites/${encodeURIComponent(token)}/accept`,
      { login, password },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }

  account(): Observable<Account> {
    return this.http.get<Account>('/api/me');
  }

  /** The teacher's name as the students see it. */
  renameTeacher(displayName: string): Observable<Account> {
    return this.http.put<Account>('/api/teacher/profile', { displayName });
  }

  /** A student's own name in the cabinet; empty — the name the teacher gave. */
  renameSelf(displayName: string): Observable<Account> {
    return this.http.put<Account>('/api/me/profile', { displayName });
  }

  changeAvatar(photo: Blob): Observable<Account> {
    const body = new FormData();
    body.append('file', photo, 'avatar');
    return this.http.put<Account>('/api/me/avatar', body);
  }

  removeAvatar(): Observable<Account> {
    return this.http.delete<Account>('/api/me/avatar');
  }

  changePassword(currentPassword: string, newPassword: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      '/api/me/password',
      { currentPassword, newPassword },
      { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
    );
  }
}
