import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { SKIP_ERROR_TOAST, quietContext } from '@core/http/api-error.interceptor';
import {
  AiStatus,
  HomeworkBrief,
  HomeworkDraft,
  PromptInput,
  RequestPage,
  ReviewBrief,
  ReviewDraft,
  SavedPrompt,
  UsageReport,
} from './ai.models';

const PROMPTS = '/api/teacher/ai/prompts';

/** HTTP client of the AI module (teacher only). */
@Injectable({ providedIn: 'root' })
export class AiApi {
  private readonly http = inject(HttpClient);

  /**
   * Whether AI buttons should be shown. Loaded once per session: the provider is configured on
   * the server and does not change while the app is open. Errors hide the buttons quietly.
   */
  readonly enabled$: Observable<boolean> = this.http
    .get<AiStatus>('/api/teacher/ai/status', {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    })
    .pipe(
      map((status) => status.enabled),
      catchError(() => of(false)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

  status(): Observable<AiStatus> {
    return this.http.get<AiStatus>('/api/teacher/ai/status');
  }

  /**
   * Errors are shown by the caller next to the form. Picked files not saved yet go with the brief as
   * `multipart/form-data` (ADR-0042).
   */
  homeworkDraft(brief: HomeworkBrief, files: readonly File[] = []): Observable<HomeworkDraft> {
    let body: HomeworkBrief | FormData = brief;
    if (files.length > 0) {
      body = new FormData();
      body.append('brief', new Blob([JSON.stringify(brief)], { type: 'application/json' }));
      for (const file of files) {
        body.append('files', file, file.name);
      }
    }
    return this.http.post<HomeworkDraft>('/api/teacher/ai/homework-draft', body, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  /** The teacher's library of prompts, by title. */
  prompts(): Observable<SavedPrompt[]> {
    return this.http.get<SavedPrompt[]>(PROMPTS, { context: quietContext() });
  }

  savePrompt(input: PromptInput): Observable<SavedPrompt> {
    return this.http.post<SavedPrompt>(PROMPTS, input);
  }

  updatePrompt(id: string, input: PromptInput, version: number): Observable<SavedPrompt> {
    return this.http.put<SavedPrompt>(`${PROMPTS}/${id}`, { ...input, version });
  }

  deletePrompt(id: string): Observable<unknown> {
    return this.http.delete(`${PROMPTS}/${id}`);
  }

  reviewDraft(brief: ReviewBrief): Observable<ReviewDraft> {
    return this.http.post<ReviewDraft>('/api/teacher/ai/review-draft', brief);
  }

  /** @param month `yyyy-MM`, the current month when omitted */
  usage(month?: string): Observable<UsageReport> {
    const params = month === undefined ? new HttpParams() : new HttpParams().set('month', month);
    return this.http.get<UsageReport>('/api/teacher/ai/usage', { params });
  }

  /**
   * The requests of a month older than those already shown, by 10.
   *
   * @param month `yyyy-MM`
   * @param offset how many newer requests are already shown
   */
  requests(month: string, offset: number): Observable<RequestPage> {
    const params = new HttpParams().set('month', month).set('offset', offset);
    return this.http.get<RequestPage>('/api/teacher/ai/requests', { params });
  }
}
