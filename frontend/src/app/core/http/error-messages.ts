import { HttpErrorResponse } from '@angular/common/http';
import { CORE_T } from '@core/i18n/texts';
import { isProblemDetail, problemCode, requestCode } from './problem-detail';

/** Messages for backend error codes in the current language. Unknown codes fall back to the HTTP status. */
const CODE_MESSAGES: Readonly<Record<string, string>> = CORE_T.errors.codes;

const STATUS_MESSAGES: Readonly<Record<number, string>> = CORE_T.errors.statuses;

const FALLBACK = CORE_T.errors.fallback;

export function messageForCode(code: string): string | undefined {
  return CODE_MESSAGES[code];
}

const SERVER_ERROR = 500;

/** Message for the backend error code of `error`, or `fallback` when the code is unknown. */
export function describeError(error: unknown, fallback: string): string {
  const code = problemCode(error);
  return withRequestCode((code === null ? undefined : messageForCode(code)) ?? fallback, error);
}

/** Human-readable message for a failed HTTP call. */
export function errorMessage(error: HttpErrorResponse): string {
  const body: unknown = error.error;
  if (isProblemDetail(body) && body.code !== undefined) {
    const known = messageForCode(body.code);
    if (known !== undefined) {
      return withRequestCode(known, error);
    }
  }
  return withRequestCode(STATUS_MESSAGES[error.status] ?? FALLBACK, error);
}

/** Server failures get the request code: the user names it, the administrator finds it in the log. */
function withRequestCode(message: string, error: unknown): string {
  if (!(error instanceof HttpErrorResponse) || error.status < SERVER_ERROR) {
    return message;
  }
  const code = requestCode(error);
  return code === null ? message : CORE_T.errors.withRequestCode(message, code);
}
