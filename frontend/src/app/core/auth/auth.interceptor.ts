import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const UNAUTHORIZED = 401;

/** Authentication endpoints manage the session themselves (cookie-based). */
function needsAccessToken(request: HttpRequest<unknown>): boolean {
  return request.url.startsWith('/api/') && !request.url.startsWith('/api/auth/');
}

/**
 * Adds the access token to API calls. An expiring token is refreshed before the call; a 401
 * response triggers one refresh and a single retry.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  if (!needsAccessToken(request) || token === null) {
    return next(request);
  }
  const send = (accessToken: string) =>
    next(request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
  const ready$ = auth.isAccessTokenFresh() ? of(token) : auth.refresh();

  return ready$.pipe(
    switchMap((accessToken) =>
      send(accessToken).pipe(
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === UNAUTHORIZED
            ? auth.refresh().pipe(switchMap(send))
            : throwError(() => error),
        ),
      ),
    ),
  );
};
