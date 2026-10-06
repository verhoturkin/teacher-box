import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MeetingRoom, MyRoom, RoomOwnerRef, YandexStatus } from './meetings.models';

function ownerIds(owner: RoomOwnerRef): { studentId: string | null; groupId: string | null } {
  return owner.type === 'GROUP'
    ? { studentId: null, groupId: owner.id }
    : { studentId: owner.id, groupId: null };
}

/** HTTP client of the meetings module. */
@Injectable({ providedIn: 'root' })
export class MeetingsApi {
  private readonly http = inject(HttpClient);

  yandexStatus(context?: HttpContext): Observable<YandexStatus> {
    return this.http.get<YandexStatus>('/api/teacher/meetings/yandex', { context });
  }

  saveClient(clientId: string, clientSecret: string): Observable<YandexStatus> {
    return this.http.put<YandexStatus>('/api/teacher/meetings/yandex/client', {
      clientId,
      clientSecret,
    });
  }

  setWaitingRoom(enabled: boolean): Observable<YandexStatus> {
    return this.http.put<YandexStatus>('/api/teacher/meetings/yandex/waiting-room', { enabled });
  }

  /** @returns the address of Yandex's consent page */
  authorize(origin: string): Observable<string> {
    return this.http
      .post<{ url: string }>('/api/teacher/meetings/yandex/authorize', { origin })
      .pipe(map((response) => response.url));
  }

  disconnect(): Observable<void> {
    return this.http.delete('/api/teacher/meetings/yandex').pipe(map(() => undefined));
  }

  rooms(context?: HttpContext): Observable<MeetingRoom[]> {
    return this.http.get<MeetingRoom[]>('/api/teacher/meetings/rooms', { context });
  }

  /** Creates a Telemost meeting for the owner through the API. */
  createRoom(owner: RoomOwnerRef): Observable<MeetingRoom> {
    return this.http.post<MeetingRoom>('/api/teacher/meetings/rooms', ownerIds(owner));
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
