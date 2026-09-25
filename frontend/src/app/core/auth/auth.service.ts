import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  map,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { SKIP_ERROR_TOAST } from '@core/http/api-error.interceptor';
import { AuthResponse, Role, SessionUser } from './auth.models';

interface SessionState {
  readonly accessToken: string;
  /** Epoch milliseconds. */
  readonly expiresAt: number;
  readonly user: SessionUser;
}

/** Refresh the access token when it expires within this margin. */
const REFRESH_MARGIN_MS = 30_000;

/**
 * Session of the signed-in user (ADR-0003). The access token lives only in memory; the refresh token
 * is an HttpOnly cookie that the browser sends to `/api/auth` automatically.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly state = signal<SessionState | null>(null);
  private refreshInFlight: Observable<string> | null = null;

  readonly user = computed(() => this.state()?.user ?? null);
  readonly role = computed<Role | null>(() => this.state()?.user.role ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);

  accessToken(): string | null {
    return this.state()?.accessToken ?? null;
  }

  isAccessTokenFresh(): boolean {
    const state = this.state();
    return state !== null && state.expiresAt - Date.now() > REFRESH_MARGIN_MS;
  }

  /** Start page of the current user: the teacher area, the student area or the sign-in page. */
  homeUrl(): string {
    switch (this.role()) {
      case 'TEACHER':
        return '/teacher';
      case 'STUDENT':
        return '/cabinet';
      case null:
        return '/login';
    }
  }

  login(login: string, password: string): Observable<SessionUser> {
    return this.http
      .post<AuthResponse>(
        '/api/auth/login',
        { login, password },
        { context: new HttpContext().set(SKIP_ERROR_TOAST, true) },
      )
      .pipe(map((response) => this.acceptSession(response)));
  }

  /** Stores a session returned by the backend (sign-in, invitation, password change). */
  acceptSession(response: AuthResponse): SessionUser {
    this.state.set({
      accessToken: response.accessToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
      user: response.user,
    });
    return response.user;
  }

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers share one request.
   * When the session cannot be renewed, the user is sent to the sign-in page.
   */
  refresh(): Observable<string> {
    this.refreshInFlight ??= this.requestRefresh().pipe(
      map((response) => {
        this.acceptSession(response);
        return response.accessToken;
      }),
      catchError((error: unknown) => {
        this.state.set(null);
        void this.router.navigate(['/login'], { queryParams: { expired: 1 } });
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight;
  }

  /** Restores the session after a page reload. Resolves in any case. */
  restore(): Promise<void> {
    return firstValueFrom(
      this.requestRefresh().pipe(
        tap((response) => this.acceptSession(response)),
        map(() => undefined),
        catchError(() => of(undefined)),
      ),
    );
  }

  logout(): Observable<void> {
    return this.http
      .post<unknown>('/api/auth/logout', null, {
        context: new HttpContext().set(SKIP_ERROR_TOAST, true),
      })
      .pipe(
        catchError(() => of(undefined)),
        map(() => undefined),
        finalize(() => {
          this.state.set(null);
          void this.router.navigateByUrl('/login');
        }),
      );
  }

  private requestRefresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/refresh', null, {
      context: new HttpContext().set(SKIP_ERROR_TOAST, true),
    });
  }
}
