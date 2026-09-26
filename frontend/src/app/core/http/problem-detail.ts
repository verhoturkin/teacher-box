import { HttpErrorResponse } from '@angular/common/http';

/** RFC 9457 problem response produced by the backend (see ProblemDetailsAdvice). */
export interface ProblemDetail {
  readonly status: number;
  readonly title?: string;
  readonly detail?: string;
  /** Stable machine-readable error code, e.g. `student.not-found`. */
  readonly code?: string;
  /** Field validation errors: field name → message. */
  readonly errors?: Readonly<Record<string, string>>;
  /** Code of the request in the server log, e.g. `k3m9x2ab7c`. */
  readonly requestId?: string;
}

export function isProblemDetail(value: unknown): value is ProblemDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof value.status === 'number'
  );
}

/** Backend error code of a failed HTTP call, if the response is a problem detail. */
export function problemCode(error: unknown): string | null {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (isProblemDetail(body) && body.code !== undefined) {
      return body.code;
    }
  }
  return null;
}

/** Header with the code of the request in the server log. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Code of a failed request in the server log, so that the user can name it to the administrator. */
export function requestCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  if (isProblemDetail(body) && typeof body.requestId === 'string' && body.requestId !== '') {
    return body.requestId;
  }
  return error.headers.get(REQUEST_ID_HEADER);
}
