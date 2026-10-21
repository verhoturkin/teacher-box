import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, of, tap } from 'rxjs';
import { quietContext } from '@core/http/api-error.interceptor';

/** The student's open tasks: the counter on «Задания» in the rail and the bottom bar. */
@Injectable({ providedIn: 'root' })
export class OpenTasks {
  private readonly http = inject(HttpClient);
  private readonly state = signal(0);

  readonly count = this.state.asReadonly();

  /** Reloads the counter; a failed request keeps the last known value silently. */
  refresh(): void {
    this.http
      .get<{ open: number }>('/api/me/homework/summary', { context: quietContext() })
      .pipe(
        map((summary) => summary.open),
        tap((open) => {
          this.state.set(open);
        }),
        catchError(() => of(this.state())),
      )
      .subscribe();
  }
}
