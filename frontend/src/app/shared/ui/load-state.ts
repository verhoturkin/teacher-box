import { HttpErrorResponse } from '@angular/common/http';
import { Signal, computed, signal } from '@angular/core';
import { EMPTY, MonoTypeOperatorFunction, catchError, defer, tap } from 'rxjs';
import { errorMessage } from '@core/http/error-messages';

/** Loading, failed or loaded (ADR-0025). */
export type LoadStatus = 'loading' | 'error' | 'ready';

const UNKNOWN_ERROR = 'Что-то пошло не так. Попробуйте ещё раз или чуть позже';

/**
 * The state of what a page or a section loads (ADR-0025): the empty state is shown only after the
 * answer, a failure is an error with «Повторить», not «nothing here».
 *
 * ```ts
 * protected readonly state = new LoadState();
 * load(): void {
 *   this.api.students().pipe(this.state.track()).subscribe((list) => this.students.set(list));
 * }
 * ```
 * ```html
 * <tb-load-state [state]="state" what="учеников" (retry)="load()">…the list…</tb-load-state>
 * ```
 */
export class LoadState {
  private readonly current = signal<LoadStatus>('loading');
  private readonly failure = signal<string | null>(null);

  readonly status: Signal<LoadStatus> = this.current.asReadonly();
  /** What went wrong, with the code of the request for server failures. */
  readonly error: Signal<string | null> = this.failure.asReadonly();
  readonly loading = computed(() => this.current() === 'loading');
  readonly ready = computed(() => this.current() === 'ready');

  /**
   * Follows a load: loading until the first value (a reload of a loaded section keeps its content),
   * ready after it, error when it fails. The error ends the stream: the page shows it itself.
   */
  track<T>(): MonoTypeOperatorFunction<T> {
    return (source) =>
      defer(() => {
        if (this.current() !== 'ready') {
          this.current.set('loading');
        }
        this.failure.set(null);
        return source;
      }).pipe(
        tap({
          next: () => {
            this.current.set('ready');
          },
          complete: () => {
            this.current.set('ready');
          },
        }),
        catchError((error: unknown) => {
          this.fail(error);
          return EMPTY;
        }),
      );
  }

  /** Marks the state loaded without a request (e.g. nothing to load). */
  done(): void {
    this.failure.set(null);
    this.current.set('ready');
  }

  /** Marks the load failed. */
  fail(error: unknown): void {
    this.failure.set(error instanceof HttpErrorResponse ? errorMessage(error) : UNKNOWN_ERROR);
    this.current.set('error');
  }
}
