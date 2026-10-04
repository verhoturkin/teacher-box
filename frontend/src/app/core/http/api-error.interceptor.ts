import {
  HttpContext,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Snackbar } from '@core/snackbar/snackbar';
import { errorMessage } from './error-messages';

/** Set to `true` on a request that handles its errors itself (no global toast). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/**
 * The context of a request whose failure the page shows itself: a load of a page or a section
 * shows its error with «Повторить» in place (ADR-0025), not in a toast.
 */
export function quietContext(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_TOAST, true);
}

const UNAUTHORIZED = 401;

/**
 * Shows a toast for failed API calls, the same message once. 401 is excluded: it is handled by the
 * auth flow. The error is always re-thrown so callers can react as well.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const snackbar = inject(Snackbar);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status !== UNAUTHORIZED &&
        !request.context.get(SKIP_ERROR_TOAST)
      ) {
        snackbar.error(errorMessage(error));
      }
      return throwError(() => error);
    }),
  );
};
