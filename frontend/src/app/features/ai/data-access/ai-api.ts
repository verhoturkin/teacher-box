import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { AiStatus, HomeworkBrief, HomeworkDraft, ReviewBrief, ReviewDraft, UsageReport } from './ai.models';

/** HTTP client of the AI module (teacher only). */
@Injectable({ providedIn: 'root' })
export class AiApi {
  private readonly http = inject(HttpClient);

  /**
   * Whether AI buttons should be shown. Loaded once per session: the provider is configured on
   * the server and does not change while the app is open. Errors hide the buttons quietly.
   */
  readonly enabled$: Observable<boolean> = this.http
    .get<AiStatus>('/api/teacher/ai/status', { context: new HttpContext().set(SKIP_ERROR_TOAST, true) })
    .pipe(
      map((status) => status.enabled),
      catchError(() => of(false)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

  status(): Observable<AiStatus> {
    return this.http.get<AiStatus>('/api/teacher/ai/status');
  }

  /** Errors are shown by the caller next to the form. */
  homeworkDraft(brief: HomeworkBrief): Observable<HomeworkDraft> {
    return this.http.post<HomeworkDraft>('/api/teacher/ai/homework-draft', brief, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  reviewDraft(brief: ReviewBrief): Observable<ReviewDraft> {
    return this.http.post<ReviewDraft>('/api/teacher/ai/review-draft', brief);
  }

  /** @param month `yyyy-MM`, the current month when omitted */
  usage(month?: string): Observable<UsageReport> {
    const params = month === undefined ? new HttpParams() : new HttpParams().set('month', month);
    return this.http.get<UsageReport>('/api/teacher/ai/usage', { params });
  }
}
