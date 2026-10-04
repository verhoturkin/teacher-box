import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import {
  ApproveRequest,
  AttendanceMark,
  BusyTime,
  CalendarFeed,
  CancelLessonRequest,
  ChangeRequest,
  ChangeRequestBody,
  EditLessonRequest,
  GoogleCalendarStatus,
  LessonOutcome,
  LessonSeries,
  MyScheduleSummary,
  OffTime,
  OffTimePeriod,
  OffTimeRequest,
  PlanLessonRequest,
  ScheduleSettings,
  ScheduleSummary,
  ScheduledLesson,
  SeriesPlanned,
  SeriesRequest,
} from './schedule.models';

/** Requests whose errors the dialog (e.g. an overlap) or the page (a failed load, ADR-0025) shows itself. */
const QUIET = { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };

/** HTTP client of the schedule module. */
@Injectable({ providedIn: 'root' })
export class ScheduleApi {
  private readonly http = inject(HttpClient);

  settings(): Observable<ScheduleSettings> {
    return this.http.get<ScheduleSettings>('/api/me/schedule/settings', QUIET);
  }

  /** Lessons that start on days `[from, to)` (`yyyy-MM-dd`). */
  lessons(from: string, to: string): Observable<ScheduledLesson[]> {
    return this.http.get<ScheduledLesson[]>('/api/teacher/schedule/lessons', {
      ...QUIET,
      params: range(from, to),
    });
  }

  plan(request: PlanLessonRequest): Observable<ScheduledLesson> {
    return this.http.post<ScheduledLesson>('/api/teacher/schedule/lessons', request, QUIET);
  }

  edit(lessonId: string, request: EditLessonRequest): Observable<ScheduledLesson> {
    return this.http.put<ScheduledLesson>(
      `/api/teacher/schedule/lessons/${lessonId}`,
      request,
      QUIET,
    );
  }

  cancel(lessonId: string, request: CancelLessonRequest): Observable<ScheduledLesson> {
    return this.http.post<ScheduledLesson>(
      `/api/teacher/schedule/lessons/${lessonId}/cancel`,
      request,
    );
  }

  /** Deletes a lesson that was not held (planned, or cancelled without a charge). */
  deleteLesson(lessonId: string): Observable<void> {
    return this.http.delete(`/api/teacher/schedule/lessons/${lessonId}`).pipe(map(() => undefined));
  }

  /** Puts a cancelled lesson back; an overlap with another lesson is reported unless allowed. */
  restore(lessonId: string, allowOverlap = false): Observable<ScheduledLesson> {
    return this.http.post<ScheduledLesson>(
      `/api/teacher/schedule/lessons/${lessonId}/restore`,
      { allowOverlap },
      QUIET,
    );
  }

  setOutcome(lessonId: string, outcome: LessonOutcome): Observable<ScheduledLesson> {
    return this.http.put<ScheduledLesson>(`/api/teacher/schedule/lessons/${lessonId}/outcome`, {
      outcome,
    });
  }

  /** Attendance of every participant of a started lesson (a group lesson or a lesson with one student). */
  markAttendance(
    lessonId: string,
    marks: Readonly<Record<string, AttendanceMark>>,
  ): Observable<ScheduledLesson> {
    return this.http.put<ScheduledLesson>(`/api/teacher/schedule/lessons/${lessonId}/attendance`, {
      marks,
    });
  }

  reopen(lessonId: string): Observable<ScheduledLesson> {
    return this.http.delete<ScheduledLesson>(`/api/teacher/schedule/lessons/${lessonId}/outcome`);
  }

  /** Lessons that have ended without a marked outcome. */
  unmarked(): Observable<ScheduledLesson[]> {
    return this.http.get<ScheduledLesson[]>('/api/teacher/schedule/unmarked', QUIET);
  }

  series(): Observable<LessonSeries[]> {
    return this.http.get<LessonSeries[]>('/api/teacher/schedule/series', QUIET);
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
    return this.http.get<ChangeRequest[]>('/api/teacher/schedule/requests', QUIET);
  }

  approve(requestId: string, request: ApproveRequest): Observable<ScheduledLesson> {
    return this.http.post<ScheduledLesson>(
      `/api/teacher/schedule/requests/${requestId}/approve`,
      request,
      QUIET,
    );
  }

  decline(requestId: string, answer: string | null): Observable<ChangeRequest> {
    return this.http.post<ChangeRequest>(
      `/api/teacher/schedule/requests/${requestId}/decline`,
      { answer },
      QUIET,
    );
  }

  myLessons(from: string, to: string): Observable<ScheduledLesson[]> {
    return this.http.get<ScheduledLesson[]>('/api/me/schedule/lessons', {
      ...QUIET,
      params: range(from, to),
    });
  }

  requestChange(lessonId: string, body: ChangeRequestBody): Observable<ChangeRequest> {
    return this.http.post<ChangeRequest>(
      `/api/me/schedule/lessons/${lessonId}/requests`,
      body,
      QUIET,
    );
  }

  myRequests(): Observable<ChangeRequest[]> {
    return this.http.get<ChangeRequest[]>('/api/me/schedule/requests', QUIET);
  }

  withdraw(requestId: string): Observable<unknown> {
    return this.http.delete(`/api/me/schedule/requests/${requestId}`);
  }

  feed(): Observable<CalendarFeed> {
    return this.http.get<CalendarFeed>('/api/me/schedule/feed', QUIET);
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
    return this.http.put<GoogleCalendarStatus>('/api/teacher/schedule/google/client', {
      clientId,
      clientSecret,
    });
  }

  /** @returns the address of Google's consent page */
  authorizeGoogle(origin: string, busy: boolean): Observable<{ url: string }> {
    return this.http.post<{ url: string }>('/api/teacher/schedule/google/authorize', {
      origin,
      busy,
    });
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

  /** The teacher's off time that is not over: weekly first, then once by its start. */
  offTimes(): Observable<OffTime[]> {
    return this.http.get<OffTime[]>('/api/teacher/schedule/off-times', QUIET);
  }

  createOffTime(request: OffTimeRequest): Observable<OffTime> {
    return this.http.post<OffTime>('/api/teacher/schedule/off-times', request, QUIET);
  }

  changeOffTime(offTimeId: string, request: OffTimeRequest): Observable<OffTime> {
    return this.http.put<OffTime>(`/api/teacher/schedule/off-times/${offTimeId}`, request, QUIET);
  }

  deleteOffTime(offTimeId: string): Observable<void> {
    return this.http
      .delete(`/api/teacher/schedule/off-times/${offTimeId}`)
      .pipe(map(() => undefined));
  }

  /** Periods of the teacher's off time in `[from, to)` (ISO instants). */
  offTimePeriods(from: string, to: string): Observable<OffTimePeriod[]> {
    return this.http.get<OffTimePeriod[]>('/api/teacher/schedule/off-times/periods', {
      params: new HttpParams().set('from', from).set('to', to),
    });
  }

  /** For a student: when the teacher is busy in `[from, to)` (ISO instants), without whose lessons. */
  teacherBusy(from: string, to: string): Observable<BusyTime[]> {
    return this.http.get<BusyTime[]>('/api/me/schedule/busy', {
      ...QUIET,
      params: new HttpParams().set('from', from).set('to', to),
    });
  }

  summary(): Observable<ScheduleSummary> {
    return this.http.get<ScheduleSummary>('/api/teacher/schedule/summary', QUIET);
  }

  mySummary(): Observable<MyScheduleSummary> {
    return this.http.get<MyScheduleSummary>('/api/me/schedule/summary', QUIET);
  }
}

function range(from: string, to: string): HttpParams {
  return new HttpParams().set('from', from).set('to', to);
}
