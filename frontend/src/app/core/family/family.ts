import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { quietContext } from '@core/http/api-error.interceptor';
import { ApiScope } from '@core/http/api-scope';
import { LABEL_COLORS, LabelColor, labelKey } from '@core/theme/label-colors';

/** A child in the family cabinet: `StudentSummary` of `GET /api/guardian/children`. */
export interface FamilyChild {
  readonly id: string;
  readonly displayName: string;
  readonly status: 'INVITED' | 'ACTIVE' | 'DEACTIVATED';
  /** Address of the child's photo; `null`: the initials. */
  readonly avatar: string | null;
}

/**
 * The colours of the children in the switcher, by their order. *Our decision:* the teacher's colours
 * of the students are the teacher's labels and do not reach a parent; the children get palette
 * colours three steps apart (red, lime, cyan…), so two or three of them are told apart at a glance.
 */
const CHILD_COLORS: readonly LabelColor[] = LABEL_COLORS.map(
  (_, index) => LABEL_COLORS[(index * 3) % LABEL_COLORS.length] ?? 'BLUE',
);

interface Loaded {
  /** The parent the list belongs to: another sign-in loads it again. */
  readonly owner: string;
  readonly children: readonly FamilyChild[];
}

/** The parent's children (ADR-0069) and the one the family cabinet shows. */
@Injectable({ providedIn: 'root' })
export class Family {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly state = signal<Loaded | null>(null);

  /** The children of the signed-in parent; empty until loaded. */
  readonly children = computed<readonly FamilyChild[]>(() => {
    const state = this.state();
    return state !== null && state.owner === (this.auth.user()?.id ?? '') ? state.children : [];
  });
  /** The child of the address (`/family/:studentId/...`). */
  readonly current = signal<string | null>(null);
  readonly child = computed(
    () => this.children().find((child) => child.id === this.current()) ?? null,
  );

  /** The children, from the server once per sign-in; a failure is an empty list, asked again next time. */
  load(): Observable<readonly FamilyChild[]> {
    const owner = this.auth.user()?.id ?? '';
    const state = this.state();
    if (state !== null && state.owner === owner) {
      return of(state.children);
    }
    return this.http.get<FamilyChild[]>('/api/guardian/children', { context: quietContext() }).pipe(
      tap((children) => {
        this.state.set({ owner, children });
      }),
      catchError(() => of([])),
    );
  }

  /** `data-tb-label` of a child's avatar: their colour in the switcher. */
  label(childId: string): string {
    const index = Math.max(
      0,
      this.children().findIndex((child) => child.id === childId),
    );
    return labelKey(CHILD_COLORS[index % CHILD_COLORS.length] ?? 'BLUE');
  }
}

/** The first word of a child's name: «Петя». */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * The scope of the family cabinet: the child of the address, read-only, the parent's calendar link of
 * all the children (ADR-0069). The family route provides it with its own API clients.
 */
export function familyScope(): ApiScope {
  const family = inject(Family);
  return {
    api: computed(() => `/api/guardian/students/${family.current() ?? ''}`),
    area: computed(() => `/family/${family.current() ?? ''}`),
    feed: '/api/guardian/schedule/feed',
    readOnly: true,
  };
}
