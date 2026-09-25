import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BroadcastRequest, ChannelState, ChannelType, LinkCode, NotificationPage } from './notifications.models';

/** HTTP client of the notifications module. */
@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);

  page(page: number, size: number): Observable<NotificationPage> {
    return this.http.get<NotificationPage>('/api/me/notifications', {
      params: new HttpParams().set('page', page).set('size', size),
    });
  }

  markRead(id: string): Observable<unknown> {
    return this.http.post<unknown>(`/api/me/notifications/${id}/read`, null);
  }

  markAllRead(): Observable<unknown> {
    return this.http.post<unknown>('/api/me/notifications/read-all', null);
  }

  channels(): Observable<ChannelState[]> {
    return this.http.get<ChannelState[]>('/api/me/channels');
  }

  createLinkCode(channel: ChannelType): Observable<LinkCode> {
    return this.http.post<LinkCode>(`/api/me/channels/${channel}/link-code`, null);
  }

  setChannelEnabled(channel: ChannelType, enabled: boolean): Observable<ChannelState> {
    return this.http.put<ChannelState>(`/api/me/channels/${channel}`, { enabled });
  }

  unlink(channel: ChannelType): Observable<unknown> {
    return this.http.delete<unknown>(`/api/me/channels/${channel}`);
  }

  /** @returns number of students who received the message */
  broadcast(request: BroadcastRequest): Observable<number> {
    return this.http
      .post<{ recipients: number }>('/api/teacher/notifications/broadcast', request)
      .pipe(map((response) => response.recipients));
  }
}
