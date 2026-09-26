import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import {
  AiStatus,
  AiUsage,
  EventPublication,
  FailedDelivery,
  IntegrationStatus,
  LogLevelName,
  LogQuery,
  LogResult,
  LoggerLevel,
  SystemStatus,
} from './admin.models';

const ADMIN = '/api/admin';

/** HTTP client of the administrator area. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  logs(query: LogQuery): Observable<LogResult> {
    let params = new HttpParams().set('limit', query.limit);
    for (const [name, value] of [
      ['from', query.from],
      ['level', query.level],
      ['logger', query.logger],
      ['text', query.text],
      ['requestId', query.requestId],
    ] as const) {
      if (value !== null && value.trim() !== '') {
        params = params.set(name, value.trim());
      }
    }
    return this.http.get<LogResult>(`${ADMIN}/logs`, { params });
  }

  loggers(): Observable<LoggerLevel[]> {
    return this.http.get<LoggerLevel[]>(`${ADMIN}/loggers`);
  }

  changeLevel(name: string, level: LogLevelName, minutes: number): Observable<LoggerLevel> {
    return this.http.put<LoggerLevel>(`${ADMIN}/loggers/${encodeURIComponent(name)}`, { level, minutes });
  }

  revertLevel(name: string): Observable<LoggerLevel> {
    return this.http.delete<LoggerLevel>(`${ADMIN}/loggers/${encodeURIComponent(name)}`);
  }

  status(): Observable<SystemStatus> {
    return this.http.get<SystemStatus>(`${ADMIN}/status`);
  }

  events(): Observable<EventPublication[]> {
    return this.http.get<EventPublication[]>(`${ADMIN}/events`);
  }

  /** @param ids empty: all incomplete events */
  resubmitEvents(ids: string[]): Observable<number> {
    return this.http
      .post<{ resubmitted: number }>(`${ADMIN}/events/resubmit`, { ids })
      .pipe(map((result) => result.resubmitted));
  }

  failedDeliveries(): Observable<FailedDelivery[]> {
    return this.http.get<FailedDelivery[]>(`${ADMIN}/notifications/deliveries`);
  }

  /** @param ids empty: all the latest failed deliveries */
  retryDeliveries(ids: string[]): Observable<number> {
    return this.http
      .post<{ retried: number }>(`${ADMIN}/notifications/deliveries/retry`, { ids })
      .pipe(map((result) => result.retried));
  }

  /** Talks to the external services; failures are shown on the page. */
  checkIntegrations(): Observable<IntegrationStatus[]> {
    return this.http.post<IntegrationStatus[]>(`${ADMIN}/integrations/check`, null, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }

  aiStatus(): Observable<AiStatus> {
    return this.http.get<AiStatus>(`${ADMIN}/ai/status`);
  }

  aiUsage(): Observable<AiUsage> {
    return this.http.get<AiUsage>(`${ADMIN}/ai/usage`);
  }

  diagnostics(): Observable<Blob> {
    return this.http.get(`${ADMIN}/diagnostics`, { responseType: 'blob' });
  }
}
