import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * Whose cabinet the student's pages show (ADR-0069): the student's own (`/api/me/...`, links under
 * `/cabinet`) or a child's in the family cabinet (`/api/guardian/students/<id>/...`, links under
 * `/family/<id>`, read-only). The student's widgets and pages take their addresses from it, so the
 * family cabinet reuses them without copies; the family route provides its own scope and its own
 * instances of the API clients.
 */
export interface ApiScope {
  /** The base of the cabinet's requests: `/api/me` or `/api/guardian/students/<id>`. */
  readonly api: Signal<string>;
  /** The base of the cabinet's links: `/cabinet` or `/family/<id>`. */
  readonly area: Signal<string>;
  /** The calendar link's address: the student's own, or the parent's one of all the children. */
  readonly feed: string;
  /** The family cabinet: the parent reads, never hands in, answers, asks or joins (ADR-0069). */
  readonly readOnly: boolean;
}

/** The student's own cabinet. */
export const STUDENT_SCOPE: ApiScope = {
  api: signal('/api/me').asReadonly(),
  area: signal('/cabinet').asReadonly(),
  feed: '/api/me/schedule/feed',
  readOnly: false,
};

/** The scope of the cabinet pages; the student's by default. */
export const API_SCOPE = new InjectionToken<ApiScope>('ApiScope', {
  providedIn: 'root',
  factory: () => STUDENT_SCOPE,
});
