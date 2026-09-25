/** RFC 9457 problem response produced by the backend (see ProblemDetailsAdvice). */
export interface ProblemDetail {
  readonly status: number;
  readonly title?: string;
  readonly detail?: string;
  /** Stable machine-readable error code, e.g. `student.not-found`. */
  readonly code?: string;
  /** Field validation errors: field name → message. */
  readonly errors?: Readonly<Record<string, string>>;
}

export function isProblemDetail(value: unknown): value is ProblemDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof value.status === 'number'
  );
}
