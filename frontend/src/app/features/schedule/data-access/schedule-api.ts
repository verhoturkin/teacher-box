import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import {
  ApproveRequest,
  BusyTime,
  CalendarFeed,
  CancelLessonRequest,
  ChangeRequest,
  ChangeRequestBody,
  EditLessonRequest,
  GoogleCalendarStatus,
  LessonOutcome,
  LessonSeries,
  PlanLessonRequest,
  ScheduleSettings,
  ScheduledLesson,
  SeriesPlanned,
  SeriesRequest,
} from './schedule.models';

/** Requests whose errors (e.g. an overlap) the dialog shows itself. */
const QUIET = { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };

/** HTTP client of the schedule module. */
@Injectable({ providedIn: 'root' })
export class ScheduleApi {
  private readonly http = inject(HttpClient);

  settings(): Observable<ScheduleSettings> {
    return this.http.get<ScheduleSettings>('/api/me/schedule/settings');
  }

  /** Lessons that start on days `[from, to)` (`yyyy-MM-dd`). */
  lessons(from: string, to: string): Observable<ScheduledLesson[]> {
    return this.http.get<ScheduledLesson[]>('/api/teacher/schedule/lessons', { params: range(from, to) });
  }

  plan(request: PlanLessonRequest): Observable<ScheduledLesson> {
    return this.http.post<ScheduledLesson>('/api/teacher/schedule/lessons', request, QUIET);
  }

  edit(lessonId: string, request: EditLessonRequest): Observable<ScheduledLesson> {
    return this.http.put<ScheduledLesson>(`/api/teacher/schedule/lessons/${lessonId}`, request, QUIET);
  }

  cancel(lessonId: string, request: CancelLessonRequest): Observable<ScheduledLesson> {
    return this.http.post<ScheduledLesson>(`/api/teacher/schedule/lessons/${lessonId}/cancel`, request);
  }

  setOutcome(lessonId: string, outcome: LessonOutcome): Observable<ScheduledLesson> {
    return this.http.put<ScheduledLesson>(`/api/teacher/schedule/lessons/${lessonId}/outcome`, { outcome });
  }

  reopen(lessonId: string): Observable<ScheduledLesson> {
    return this.http.delete<ScheduledLesson>(`/api/teacher/schedule/lessons/${lessonId}/outcome`);
  }

  /** Lessons that have ended without a marked outcome. */
  unmarked(): Observable<ScheduledLesson[]> {
    return this.http.get<ScheduledLesson[]>('/api/teacher/schedule/unmarked');
  }

  series(): Observable<LessonSeries[]> {
    return this.http.get<LessonSeries[]>('/api/teacher/schedule/series');
  }

  planSeries(request: SeriesRequest): Observable<SeriesPlanned> {
    return this.http.post<SeriesPlanned>('/api/teacher/schedule/series', request, QUIET);
  }

  changeSeries(seriesId: string, request: SeriesRequest): Observable<SeriesPlanned> {
    return this.http.put<SeriesPlanned>(`/api/teacher/schedule/series/${seriesId}`, request, QUIET);
  }

  /** Ends a series before `from`; its lessons from that day on are removed. */
  stopSeries(seriesId: string, from: string): Observable<unknown> {
    return this.http.post(`/api/teacher/schedule/series/${seriesId}/stop`, { from });
  }

  pendingRequests(): Observable<ChangeRequest[]> {
    return this.http.get<ChangeRequest[]>('/api/teacher/schedule/requests');
  }

  approve(requestId: string, request: ApproveRequest): Observable<ScheduledLesson> {
    return this.http.post<ScheduledLesson>(`/api/teacher/schedule/requests/${requestId}/approve`, request);
  }

  decline(requestId: string, answer: string | null): Observable<ChangeRequest> {
    return this.http.post<ChangeRequest>(`/api/teacher/schedule/requests/${requestId}/decline`, { answer });
  }

  myLessons(from: string, to: string): Observable<ScheduledLesson[]> {
    return this.http.get<ScheduledLesson[]>('/api/me/schedule/lessons', { params: range(from, to) });
  }

  requestChange(lessonId: string, body: ChangeRequestBody): Observable<ChangeRequest> {
    return this.http.post<ChangeRequest>(`/api/me/schedule/lessons/${lessonId}/requests`, body, QUIET);
  }

  myRequests(): Observable<ChangeRequest[]> {
    return this.http.get<ChangeRequest[]>('/api/me/schedule/requests');
  }

  withdraw(requestId: string): Observable<unknown> {
    return this.http.delete(`/api/me/schedule/requests/${requestId}`);
  }

  feed(): Observable<CalendarFeed> {
    return this.http.get<CalendarFeed>('/api/me/schedule/feed');
  }

  /** A new calendar link; the previous one stops working. */
  createFeed(): Observable<CalendarFeed> {
    return this.http.post<CalendarFeed>('/api/me/schedule/feed', null);
  }

  disableFeed(): Observable<unknown> {
    return this.http.delete('/api/me/schedule/feed');
  }

  googleStatus(): Observable<GoogleCalendarStatus> {
    return this.http.get<GoogleCalendarStatus>('/api/teacher/schedule/google');
  }

  saveGoogleClient(clientId: string, clientSecret: string): Observable<GoogleCalendarStatus> {
    return this.http.put<GoogleCalendarStatus>('/api/teacher/schedule/google/client', { clientId, clientSecret });
  }

  /** @returns the address of Google's consent page */
  authorizeGoogle(origin: string, busy: boolean): Observable<{ url: string }> {
    return this.http.post<{ url: string }>('/api/teacher/schedule/google/authorize', { origin, busy });
  }

  syncGoogle(): Observable<{ changed: number }> {
    return this.http.post<{ changed: number }>('/api/teacher/schedule/google/sync', null);
  }

  disconnectGoogle(): Observable<unknown> {
    return this.http.delete('/api/teacher/schedule/google');
  }

  /** Busy times of the teacher's own calendars in `[from, to)` (ISO instants). */
  googleBusy(from: string, to: string): Observable<BusyTime[]> {
    return this.http.get<BusyTime[]>('/api/teacher/schedule/google/busy', {
      params: new HttpParams().set('from', from).set('to', to),
    });
  }
}

function range(from: string, to: string): HttpParams {
  return new HttpParams().set('from', from).set('to', to);
}
