import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';

/** Number of unread notifications of the current user, shown by the bell in the navigation bar. */
@Injectable({ providedIn: 'root' })
export class UnreadNotifications {
  private readonly http = inject(HttpClient);
  private readonly state = signal(0);

  readonly count = this.state.asReadonly();

  /** Reloads the counter; a failed request keeps the last known value silently. */
  refresh(): Observable<number> {
    return this.http
      .get<{ count: number }>('/api/me/notifications/unread-count', {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(
        map((response) => response.count),
        tap((count) => {
          this.state.set(count);
        }),
        catchError(() => of(this.state())),
      );
  }

  /** Updates the counter from a response that already contains it. */
  set(count: number): void {
    this.state.set(Math.max(0, count));
  }
}
