import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { errorMessage } from './error-messages';

/** Set to `true` on a request that handles its errors itself (no global toast). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

const UNAUTHORIZED = 401;

/**
 * Shows a toast for failed API calls. 401 is excluded: it is handled by the auth flow.
 * The error is always re-thrown so callers can react as well.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const messages = inject(MessageService);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status !== UNAUTHORIZED &&
        !request.context.get(SKIP_ERROR_TOAST)
      ) {
        messages.add({ severity: 'error', summary: 'Ошибка', detail: errorMessage(error) });
      }
      return throwError(() => error);
    }),
  );
};
