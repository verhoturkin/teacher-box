import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_SCOPE } from '@core/http/api-scope';
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
  HistoryEntry,
  LessonRules,
  LessonOutcome,
  MyScheduleSummary,
  OffTime,
  OffTimePeriod,
  OffTimeRequest,
  PlanLessonRequest,
  FollowingLessons,
  RepeatScope,
  ScheduleSettings,
  ScheduleSummary,
  ScheduledLesson,
  StudentLessonPlan,
  UpcomingLessons,
} from './schedule.models';

/** Requests whose errors the dialog (e.g. an overlap) or the page (a failed load, ADR-0025) shows itself. */
/** Whose lessons: one student's (with their group lessons) or one group's. */
export type LessonsOf = { readonly studentId: string } | { readonly groupId: string };

const QUIET = { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };

/** HTTP client of the schedule module. */
@Injectable({ providedIn: 'root' })
export class ScheduleApi {
  private readonly http = inject(HttpClient);
  /** The student's own cabinet or a child's in the family cabinet (ADR-0069). */
  private readonly scope = inject(API_SCOPE);

  settings(): Observable<ScheduleSettings> {
    return this.http.get<ScheduleSettings>(`${this.scope.api()}/schedule/settings`, QUIET);
  }

  /** The teacher's lesson rules; the load is quiet (its card shows a failure itself). */
  lessonRules(): Observable<LessonRules> {
    return this.http.get<LessonRules>('/api/teacher/schedule/settings', QUIET);
  }

  /** All the rules at once; 422 `schedule.settings-*-invalid` outside the limits. */
  changeLessonRules(rules: LessonRules): Observable<LessonRules> {
    return this.http.put<LessonRules>('/api/teacher/schedule/settings', rules);
  }

  /**
   * Lessons that start on days `[from, to)` (`yyyy-MM-dd`); `of` — only those of one student (their group
   * lessons too) or of one group.
   */
  lessons(from: string, to: string, of?: LessonsOf): Observable<ScheduledLesson[]> {
    let params = range(from, to);
    if (of !== undefined) {
      params =
        'studentId' in of
          ? params.set('studentId', of.studentId)
          : params.set('groupId', of.groupId);
    }
    return this.http.get<ScheduledLesson[]>('/api/teacher/schedule/lessons', { ...QUIET, params });
  }

  /** Held lessons of a student or a group, newest first; `before` — the start of the last one shown. */
  history(of: LessonsOf, before: string | null, limit: number): Observable<HistoryEntry[]> {
    let params = new HttpParams().set('limit', limit);
    if (before !== null) {
      params = params.set('before', before);
    }
    const path = 'studentId' in of ? `students/${of.studentId}` : `groups/${of.groupId}`;
    return this.http.get<HistoryEntry[]>(`/api/teacher/schedule/${path}/history`, {
      ...QUIET,
      params,
    });
  }

  /** The lessons ahead of a student or a group: a series is one item. */
  upcoming(of: LessonsOf): Observable<UpcomingLessons> {
    const path = 'studentId' in of ? `students/${of.studentId}` : `groups/${of.groupId}`;
    return this.http.get<UpcomingLessons>(`/api/teacher/schedule/${path}/upcoming`, QUIET);
  }

  plan(request: PlanLessonRequest): Observable<ScheduledLesson> {
    return this.http.post<ScheduledLesson>('/api/teacher/schedule/lessons', request, QUIET);
  }

  /** One lesson with its details: the summary, the plan and the private notes (lists carry none). */
  lesson(lessonId: string): Observable<ScheduledLesson> {
    return this.http.get<ScheduledLesson>(`/api/teacher/schedule/lessons/${lessonId}`, QUIET);
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

  following(lessonId: string): Observable<FollowingLessons> {
    return this.http.get<FollowingLessons>(
      `/api/teacher/schedule/lessons/${lessonId}/following`,
      QUIET,
    );
  }

  /** Deletes a lesson that was not held (planned, or cancelled without a charge). */
  deleteLesson(
    lessonId: string,
    scope: RepeatScope = 'ONLY',
    version?: number,
    repeatVersion?: number | null,
  ): Observable<void> {
    let params = new HttpParams();
    if (scope === 'FOLLOWING') params = params.set('scope', scope);
    if (version !== undefined) params = params.set('version', version);
    if (repeatVersion != null) params = params.set('repeatVersion', repeatVersion);
    return this.http
      .delete(`/api/teacher/schedule/lessons/${lessonId}`, { params })
      .pipe(map(() => undefined));
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

  /** Saves «Что прошли» and «Что дальше» (an empty text clears the field). */
  updateSummary(
    lessonId: string,
    summary: string | null,
    nextPlan: string | null,
  ): Observable<ScheduledLesson> {
    return this.http.put<ScheduledLesson>(
      `/api/teacher/schedule/lessons/${lessonId}/summary`,
      { summary, nextPlan },
      QUIET,
    );
  }

  /**
   * Puts a working plan on the lesson, or takes it off (`null`); no lesson version. Errors are the caller's to
   * show: a bank item, a plan on another lesson, a cancelled lesson.
   */
  linkPlan(lessonId: string, planId: string | null): Observable<ScheduledLesson> {
    return this.http.put<ScheduledLesson>(
      `/api/teacher/schedule/lessons/${lessonId}/plan`,
      { planId },
      QUIET,
    );
  }

  /** Sends the summary to the participants as «Итоги урока». */
  shareSummary(lessonId: string): Observable<void> {
    return this.http
      .post(`/api/teacher/schedule/lessons/${lessonId}/summary/share`, null, QUIET)
      .pipe(map(() => undefined));
  }

  /** Lessons that have ended without a marked outcome. */
  unmarked(): Observable<ScheduledLesson[]> {
    return this.http.get<ScheduledLesson[]>('/api/teacher/schedule/unmarked', QUIET);
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
    return this.http.get<ScheduledLesson[]>(`${this.scope.api()}/schedule/lessons`, {
      ...QUIET,
      params: range(from, to),
    });
  }

  /** One lesson of the student with its shared summary. */
  myLesson(lessonId: string): Observable<ScheduledLesson> {
    return this.http.get<ScheduledLesson>(
      `${this.scope.api()}/schedule/lessons/${lessonId}`,
      QUIET,
    );
  }

  /** The plan of the student's lesson (a transcript only when the teacher shows it). */
  myPlan(lessonId: string): Observable<StudentLessonPlan> {
    return this.http.get<StudentLessonPlan>(
      `${this.scope.api()}/schedule/lessons/${lessonId}/plan`,
      QUIET,
    );
  }

  /** The bound pages of a textbook of the lesson plan (a PDF cut to them, or the whole file). */
  myPlanTextbook(lessonId: string, textbookId: string): Observable<Blob> {
    return this.http.get(
      `${this.scope.api()}/schedule/lessons/${lessonId}/plan/textbooks/${textbookId}`,
      { responseType: 'blob' },
    );
  }

  /** Held lessons of the student with the shared summaries, newest first. */
  myHistory(before: string | null, limit: number): Observable<HistoryEntry[]> {
    let params = new HttpParams().set('limit', limit);
    if (before !== null) {
      params = params.set('before', before);
    }
    return this.http.get<HistoryEntry[]>(`${this.scope.api()}/schedule/history`, {
      ...QUIET,
      params,
    });
  }

  requestChange(lessonId: string, body: ChangeRequestBody): Observable<ChangeRequest> {
    return this.http.post<ChangeRequest>(
      `${this.scope.api()}/schedule/lessons/${lessonId}/requests`,
      body,
      QUIET,
    );
  }

  myRequests(): Observable<ChangeRequest[]> {
    return this.http.get<ChangeRequest[]>(`${this.scope.api()}/schedule/requests`, QUIET);
  }

  withdraw(requestId: string): Observable<unknown> {
    return this.http.delete(`${this.scope.api()}/schedule/requests/${requestId}`);
  }

  feed(): Observable<CalendarFeed> {
    return this.http.get<CalendarFeed>(this.scope.feed, QUIET);
  }

  /** A new calendar link; the previous one stops working. */
  createFeed(): Observable<CalendarFeed> {
    return this.http.post<CalendarFeed>(this.scope.feed, null);
  }

  disableFeed(): Observable<unknown> {
    return this.http.delete(this.scope.feed);
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

  /**
   * For a student or a parent of the child: when the teacher is busy in `[from, to)` (ISO instants),
   * without whose lessons.
   */
  teacherBusy(from: string, to: string): Observable<BusyTime[]> {
    return this.http.get<BusyTime[]>(`${this.scope.api()}/schedule/busy`, {
      ...QUIET,
      params: new HttpParams().set('from', from).set('to', to),
    });
  }

  /**
   * Free start times (ISO instants) of `date` to move a lesson to: the teacher's view, or the cabinet's
   * (the student's own or a parent's of the child).
   */
  freeTimes(lessonId: string, date: string, asTeacher: boolean): Observable<string[]> {
    const base = asTeacher ? '/api/teacher' : this.scope.api();
    return this.http.get<string[]>(`${base}/schedule/free-times`, {
      ...QUIET,
      params: new HttpParams().set('date', date).set('lessonId', lessonId),
    });
  }

  summary(): Observable<ScheduleSummary> {
    return this.http.get<ScheduleSummary>('/api/teacher/schedule/summary', QUIET);
  }

  mySummary(): Observable<MyScheduleSummary> {
    return this.http.get<MyScheduleSummary>(`${this.scope.api()}/schedule/summary`, QUIET);
  }
}

function range(from: string, to: string): HttpParams {
  return new HttpParams().set('from', from).set('to', to);
}
