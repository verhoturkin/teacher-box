import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthResponse } from '@core/auth/auth.models';
import { SKIP_ERROR_TOAST, quietContext } from '@core/http/api-error.interceptor';
import {
  Account,
  CreatedGuardian,
  CreatedStudent,
  Guardian,
  GuardianName,
  GroupInput,
  InviteInfo,
  IssuedInvite,
  Student,
  StudentGroup,
  StudentProfileInput,
  StudentTag,
  TagChanged,
  TagKind,
  TagValueInput,
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

  /** The parents of a student (ADR-0069); the load is quiet (the card shows a failure itself). */
  guardians(studentId: string): Observable<Guardian[]> {
    return this.http.get<Guardian[]>(`/api/teacher/students/${studentId}/guardians`, {
      context: quietContext(),
    });
  }

  /** Every parent of the portal: «Уже есть в портале» picks one of them. */
  allGuardians(): Observable<Guardian[]> {
    return this.http.get<Guardian[]>('/api/teacher/guardians', { context: quietContext() });
  }

  /** A new parent with an activation link; refused (422 `guardian.limit`) over two parents. */
  createGuardian(studentId: string, displayName: string): Observable<CreatedGuardian> {
    return this.http.post<CreatedGuardian>(`/api/teacher/students/${studentId}/guardians`, {
      displayName,
    });
  }

  /** Links a parent of another student (a sibling's) without an invitation. */
  linkGuardian(studentId: string, guardianId: string): Observable<Guardian> {
    return this.http.post<Guardian>(`/api/teacher/students/${studentId}/guardians/link`, {
      guardianId,
    });
  }

  /** Activation until the parent signs up, a password reset afterwards. */
  reissueGuardianInvite(studentId: string, guardianId: string): Observable<IssuedInvite> {
    return this.http.post<IssuedInvite>(
      `/api/teacher/students/${studentId}/guardians/${guardianId}/invite`,
      null,
    );
  }

  /** The last child unlinked deactivates the parent. */
  unlinkGuardian(studentId: string, guardianId: string): Observable<unknown> {
    return this.http.delete(`/api/teacher/students/${studentId}/guardians/${guardianId}`);
  }

  /** The student's parents: «Родители: Анна» in «Мой аккаунт». */
  myGuardians(): Observable<GuardianName[]> {
    return this.http.get<GuardianName[]>('/api/me/guardians', { context: quietContext() });
  }

  deactivate(id: string): Observable<Student> {
    return this.http.post<Student>(`/api/teacher/students/${id}/deactivate`, null);
  }

  reactivate(id: string): Observable<Student> {
    return this.http.post<Student>(`/api/teacher/students/${id}/reactivate`, null);
  }

  /** The whole set of a student's tag values: a tag missing or `null` is cleared. */
  setStudentTags(id: string, tags: Readonly<Record<string, string | null>>): Observable<Student> {
    return this.http.put<Student>(`/api/teacher/students/${id}/tags`, tags);
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

  /** @param context `quietContext()` when the page shows a failed load itself (ADR-0025) */
  listTags(context?: HttpContext): Observable<StudentTag[]> {
    return this.http.get<StudentTag[]>('/api/teacher/tags', { context });
  }

  createTag(
    name: string,
    useInAi: boolean,
    values: readonly string[],
    kind: TagKind = 'LIST',
  ): Observable<StudentTag> {
    return this.http.post<StudentTag>('/api/teacher/tags', { name, kind, useInAi, values });
  }

  updateTag(
    id: string,
    tag: { name: string; kind: TagKind; useInAi: boolean; values: readonly TagValueInput[] },
    version: number,
  ): Observable<TagChanged> {
    return this.http.put<TagChanged>(`/api/teacher/tags/${id}`, { ...tag, version });
  }

  reorderTags(ids: readonly string[]): Observable<StudentTag[]> {
    return this.http.put<StudentTag[]>('/api/teacher/tags/order', { ids });
  }

  /** @returns how many students lost the tag's value */
  deleteTag(id: string): Observable<{ clearedStudents: number }> {
    return this.http.delete<{ clearedStudents: number }>(`/api/teacher/tags/${id}`);
  }
}
