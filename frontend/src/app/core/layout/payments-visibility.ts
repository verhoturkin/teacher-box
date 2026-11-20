import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { quietContext } from '@core/http/api-error.interceptor';

interface Known {
  /** The student the answer belongs to: another sign-in asks again. */
  readonly owner: string;
  readonly visible: boolean;
}

/**
 * Whether the student sees their payments (452.3, ADR-0069): the teacher hides them from a student who
 * has a parent, then `/api/me/billing/**` answers 404 `billing.hidden`. Hidden: no «Оплаты» in the
 * navigation, no balance on the home page, `/cabinet/billing` leads home.
 */
@Injectable({ providedIn: 'root' })
export class PaymentsVisibility {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly state = signal<Known | null>(null);

  /** Shown until the server says otherwise (most students see their payments). */
  readonly visible = computed(() => {
    const state = this.state();
    // another sign-in has not asked yet: shown
    return state?.owner !== (this.auth.user()?.id ?? '') || state.visible;
  });

  /** Asks the server once per sign-in; a failure keeps «Оплаты» (the page itself says what is wrong). */
  load(): Observable<boolean> {
    const owner = this.auth.user()?.id ?? '';
    const state = this.state();
    if (state !== null && state.owner === owner) {
      return of(state.visible);
    }
    return this.http
      .get<{ visible: boolean }>('/api/me/billing/visible', { context: quietContext() })
      .pipe(
        map((answer) => answer.visible),
        tap((visible) => {
          this.state.set({ owner, visible });
        }),
        catchError(() => of(true)),
      );
  }
}

/** `/cabinet/billing` of a student whose payments are hidden leads to the home page. */
export const paymentsVisibleGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(PaymentsVisibility)
    .load()
    .pipe(map((visible) => (visible ? true : router.parseUrl('/cabinet'))));
};
