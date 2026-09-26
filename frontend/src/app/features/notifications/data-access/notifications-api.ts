import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import {
  BotSettings,
  BroadcastItem,
  BroadcastRequest,
  ChannelSetup,
  ChannelState,
  ChannelType,
  LinkCode,
  NotificationPage,
  NotificationPreferences,
  StudentMessengers,
  TeacherNotificationsSummary,
} from './notifications.models';

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

  broadcasts(): Observable<BroadcastItem[]> {
    return this.http.get<BroadcastItem[]>('/api/teacher/notifications/broadcasts');
  }

  preferences(): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>('/api/me/notifications/preferences');
  }

  savePreferences(preferences: NotificationPreferences): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>('/api/me/notifications/preferences', preferences);
  }

  /** Teacher: bots of the instance. */
  bots(): Observable<ChannelSetup[]> {
    return this.http.get<ChannelSetup[]>('/api/teacher/notifications/channels');
  }

  /** Teacher: checks the token with the messenger and starts the bot. */
  saveBot(channel: ChannelType, settings: BotSettings): Observable<ChannelSetup> {
    return this.http.put<ChannelSetup>(`/api/teacher/notifications/channels/${channel}`, settings, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  removeBot(channel: ChannelType): Observable<unknown> {
    return this.http.delete<unknown>(`/api/teacher/notifications/channels/${channel}`);
  }

  /** Teacher: sends a test message to the teacher's own account. */
  testBot(channel: ChannelType): Observable<unknown> {
    return this.http.post<unknown>(`/api/teacher/notifications/channels/${channel}/test`, null, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  /** Teacher: current students and their messengers. */
  studentMessengers(): Observable<StudentMessengers[]> {
    return this.http.get<StudentMessengers[]>('/api/teacher/notifications/students');
  }

  /**
   * Teacher: asks students without a messenger to connect one.
   *
   * @param studentIds empty: all current students
   * @returns number of students asked
   */
  remindToConnect(studentIds: string[]): Observable<number> {
    return this.http
      .post<{ recipients: number }>('/api/teacher/notifications/remind-connect', { studentIds })
      .pipe(map((response) => response.recipients));
  }

  /** Teacher: notifications at a glance. */
  summary(): Observable<TeacherNotificationsSummary> {
    return this.http.get<TeacherNotificationsSummary>('/api/teacher/notifications/summary');
  }
}
