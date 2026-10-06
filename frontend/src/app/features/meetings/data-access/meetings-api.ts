import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MeetingRoom, MyRoom, RoomOwnerRef } from './meetings.models';

function ownerIds(owner: RoomOwnerRef): { studentId: string | null; groupId: string | null } {
  return owner.type === 'GROUP'
    ? { studentId: null, groupId: owner.id }
    : { studentId: owner.id, groupId: null };
}

/** HTTP client of the meetings module. */
@Injectable({ providedIn: 'root' })
export class MeetingsApi {
  private readonly http = inject(HttpClient);

  rooms(context?: HttpContext): Observable<MeetingRoom[]> {
    return this.http.get<MeetingRoom[]>('/api/teacher/meetings/rooms', { context });
  }

  enterLink(owner: RoomOwnerRef, joinUrl: string): Observable<MeetingRoom> {
    return this.http.put<MeetingRoom>('/api/teacher/meetings/rooms', {
      ...ownerIds(owner),
      joinUrl,
    });
  }

  removeRoom(ownerId: string): Observable<void> {
    return this.http.delete(`/api/teacher/meetings/rooms/${ownerId}`).pipe(map(() => undefined));
  }

  /** @returns the number of students who got the link */
  share(ownerId: string): Observable<number> {
    return this.http
      .post<{ recipients: number }>(`/api/teacher/meetings/rooms/${ownerId}/share`, null)
      .pipe(map((response) => response.recipients));
  }

  myRooms(): Observable<MyRoom[]> {
    return this.http.get<MyRoom[]>('/api/me/meetings/rooms');
  }
}
