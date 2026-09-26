import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';

/** Reports sent per minute at most: a broken page must not flood the server. */
export const REPORTS_PER_MINUTE = 5;
const MINUTE_MS = 60_000;
const MAX_MESSAGE = 2_000;
const MAX_STACK = 10_000;
const MAX_URL = 1_000;

/** What the server log gets about a browser error (`POST /api/client-errors`). */
export interface ClientErrorReport {
  readonly message: string;
  readonly url: string;
  readonly stack: string | null;
}

function describe(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return { message: `${error.name}: ${error.message}`, stack: error.stack ?? null };
  }
  return { message: typeof error === 'string' ? error : 'Unknown error', stack: null };
}

/**
 * Logs uncaught errors to the console as usual and sends them to the server log (ADR-0010), so that the
 * administrator sees them next to the server errors. HTTP errors are skipped: the server logged them.
 */
@Injectable()
export class ReportingErrorHandler extends ErrorHandler {
  /** Without interceptors: no auth retries, no toasts, no loops. */
  private readonly http = new HttpClient(inject(HttpBackend));
  private sentAt: number[] = [];
  private lastMessage: string | null = null;

  override handleError(error: unknown): void {
    super.handleError(error);
    this.report(error);
  }

  private report(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      return;
    }
    const { message, stack } = describe(error);
    const now = Date.now();
    this.sentAt = this.sentAt.filter((time) => now - time < MINUTE_MS);
    if (this.sentAt.length >= REPORTS_PER_MINUTE || message === this.lastMessage) {
      return;
    }
    this.sentAt.push(now);
    this.lastMessage = message;
    const report: ClientErrorReport = {
      message: message.slice(0, MAX_MESSAGE),
      url: window.location.pathname.slice(0, MAX_URL),
      stack: stack === null ? null : stack.slice(0, MAX_STACK),
    };
    this.http.post('/api/client-errors', report).subscribe({
      error: () => {
        // The server is unreachable or busy: the error stays in the console.
      },
    });
  }
}
