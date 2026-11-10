import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { SKIP_ERROR_TOAST, quietContext } from '@core/http/api-error.interceptor';
import {
  AiFeature,
  AiModel,
  AiProvider,
  AiSettings,
  AiStatus,
  AvailableModel,
  CheckResult,
  ConnectionChange,
  ConnectionInput,
  HomeworkBrief,
  HomeworkDraft,
  LessonSummaryBrief,
  LessonSummaryDraft,
  ModelInput,
  PromptInput,
  QuizDraft,
  RequestPage,
  ReviewBrief,
  ReviewDraft,
  SavedPrompt,
  SystemPrompt,
  UsageReport,
} from './ai.models';

const PROMPTS = '/api/teacher/ai/prompts';
const SYSTEM_PROMPTS = '/api/teacher/ai/system-prompts';
const PROVIDERS = '/api/teacher/ai/providers';

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

  /** @param quiet no toast on an error: the caller shows the status only when it comes */
  status(quiet = false): Observable<AiStatus> {
    return this.http.get<AiStatus>(
      '/api/teacher/ai/status',
      quiet ? { context: quietContext() } : {},
    );
  }

  /**
   * Errors are shown by the caller next to the form. Picked files not saved yet go with the brief as
   * `multipart/form-data` (ADR-0042).
   */
  homeworkDraft(brief: HomeworkBrief, files: readonly File[] = []): Observable<HomeworkDraft> {
    return this.draft<HomeworkDraft>('homework-draft', brief, files);
  }

  /** Questions for the quiz of an assignment, from the same request and sources as a draft. */
  quizDraft(brief: HomeworkBrief, files: readonly File[] = []): Observable<QuizDraft> {
    return this.draft<QuizDraft>('quiz-draft', brief, files);
  }

  private draft<R>(path: string, brief: HomeworkBrief, files: readonly File[]): Observable<R> {
    let body: HomeworkBrief | FormData = brief;
    if (files.length > 0) {
      body = new FormData();
      body.append('brief', new Blob([JSON.stringify(brief)], { type: 'application/json' }));
      for (const file of files) {
        body.append('files', file, file.name);
      }
    }
    return this.http.post<R>(`/api/teacher/ai/${path}`, body, {
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

  /** The system prompts of the assistant (ADR-0043), one per feature. */
  systemPrompts(): Observable<SystemPrompt[]> {
    return this.http.get<SystemPrompt[]>(SYSTEM_PROMPTS, { context: quietContext() });
  }

  /** @param version the edited version, 0 for the standard prompt */
  updateSystemPrompt(feature: AiFeature, text: string, version: number): Observable<SystemPrompt> {
    return this.http.put<SystemPrompt>(`${SYSTEM_PROMPTS}/${feature}`, { text, version });
  }

  /** Back to the standard prompt. */
  resetSystemPrompt(feature: AiFeature): Observable<SystemPrompt> {
    return this.http.delete<SystemPrompt>(`${SYSTEM_PROMPTS}/${feature}`);
  }

  reviewDraft(brief: ReviewBrief): Observable<ReviewDraft> {
    return this.http.post<ReviewDraft>('/api/teacher/ai/review-draft', brief);
  }

  /** Errors are shown by the caller next to the field. */
  lessonSummary(brief: LessonSummaryBrief): Observable<LessonSummaryDraft> {
    return this.http.post<LessonSummaryDraft>('/api/teacher/ai/lesson-summary', brief, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
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

  /** The connections in their order, each with its models (ADR-0057). */
  providers(): Observable<AiProvider[]> {
    return this.http.get<AiProvider[]>(PROVIDERS, { context: quietContext() });
  }

  /** Checks a connection before it is saved and lists its models; the dialog shows the answer. */
  checkConnection(input: ConnectionInput): Observable<CheckResult> {
    return this.http.post<CheckResult>(`${PROVIDERS}/check`, input, { context: quietContext() });
  }

  /** Saves a connection; the answer carries the state of its check. */
  createProvider(input: ConnectionInput): Observable<AiProvider> {
    return this.http.post<AiProvider>(PROVIDERS, input, { context: quietContext() });
  }

  updateProvider(id: string, change: ConnectionChange): Observable<AiProvider> {
    return this.http.put<AiProvider>(`${PROVIDERS}/${id}`, change, { context: quietContext() });
  }

  recheckProvider(id: string): Observable<AiProvider> {
    return this.http.post<AiProvider>(`${PROVIDERS}/${id}/check`, null);
  }

  /** Refused (409) while the connection holds the default model. */
  deleteProvider(id: string): Observable<unknown> {
    return this.http.delete(`${PROVIDERS}/${id}`);
  }

  /** The models the provider offers; empty when its API keeps no list. */
  availableModels(providerId: string): Observable<AvailableModel[]> {
    return this.http.get<AvailableModel[]>(`${PROVIDERS}/${providerId}/models/available`, {
      context: quietContext(),
    });
  }

  addModel(providerId: string, input: ModelInput): Observable<AiModel> {
    return this.http.post<AiModel>(`${PROVIDERS}/${providerId}/models`, input, {
      context: quietContext(),
    });
  }

  updateModel(providerId: string, modelId: string, input: ModelInput): Observable<AiModel> {
    return this.http.put<AiModel>(`${PROVIDERS}/${providerId}/models/${modelId}`, input, {
      context: quietContext(),
    });
  }

  deleteModel(providerId: string, modelId: string): Observable<unknown> {
    return this.http.delete(`${PROVIDERS}/${providerId}/models/${modelId}`);
  }

  /** The default model and the monthly limit. */
  settings(): Observable<AiSettings> {
    return this.http.get<AiSettings>('/api/teacher/ai/settings', { context: quietContext() });
  }

  saveSettings(settings: AiSettings): Observable<AiSettings> {
    return this.http.put<AiSettings>('/api/teacher/ai/settings', settings);
  }
}
