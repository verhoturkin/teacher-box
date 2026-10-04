import { computed, signal } from '@angular/core';
import { EMPTY, Observable, defer, finalize } from 'rxjs';

/**
 * Keeps an action that sends a request from being pressed twice (ADR-0026): while its request is on
 * its way the button shows `[loading]` and a second press does nothing.
 *
 * ```ts
 * protected readonly busy = new Busy();
 * retry(): void {
 *   this.busy.guard('retry', this.api.retry()).subscribe(() => this.reload());
 * }
 * ```
 * ```html
 * <p-button label="Повторить" [loading]="busy.is('retry')" (onClick)="retry()" />
 * ```
 */
export class Busy {
  private readonly active = signal<readonly string[]>([]);

  /** Some request of the guard is on its way. */
  readonly any = computed(() => this.active().length > 0);

  /** The request of this key is on its way (one key per action; a row's key includes its id). */
  is(key = ''): boolean {
    return this.active().includes(key);
  }

  /** The request, run once at a time per key: while it is on its way, the same key gets nothing. */
  guard<T>(key: string, request: Observable<T>): Observable<T> {
    return defer(() => {
      if (this.is(key)) {
        return EMPTY;
      }
      this.active.update((keys) => [...keys, key]);
      return request.pipe(
        finalize(() => {
          this.active.update((keys) => keys.filter((candidate) => candidate !== key));
        }),
      );
    });
  }
}
