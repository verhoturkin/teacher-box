import {
  Injectable,
  InjectionToken,
  Injector,
  computed,
  inject,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { Observable, catchError, firstValueFrom, of } from 'rxjs';

/** The kinds of things the global search finds, in the order the results show them (redesign spec §2, D6). */
export const SEARCH_GROUPS = ['students', 'groups', 'assignments', 'boards', 'textbooks'] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

/** One thing the teacher can jump to. */
export interface SearchEntry {
  readonly id: string;
  readonly group: SearchGroup;
  readonly title: string;
  /** A second line: the students of an assignment, the course of a textbook… */
  readonly subtitle?: string | null;
  /** Router commands of the page that shows the thing. */
  readonly link: readonly string[];
  readonly query?: Readonly<Record<string, string>>;
  /** More words that find the entry but are not shown (a login, an e-mail). */
  readonly keywords?: readonly string[];
}

/** The entries of one group: the application reads them from the lists the teacher's API already serves. */
export interface SearchSource {
  readonly group: SearchGroup;
  load(): Observable<readonly SearchEntry[]>;
}

/**
 * Builds the sources of the search. The application provides it: core/ does not import features (AGENTS.md §4.2
 * rule 6). It runs in an injection context, so a source may `inject` the API it reads.
 */
export const SEARCH_SOURCES = new InjectionToken<() => Promise<readonly SearchSource[]>>(
  'SEARCH_SOURCES',
);

/** The entries of a group the results list shows; `total` counts all that matched. */
export interface SearchResultGroup {
  readonly group: SearchGroup;
  readonly entries: readonly SearchEntry[];
  readonly total: number;
}

/** How many entries of a group the results show before «Ещё». */
export const SEARCH_GROUP_LIMIT = 5;

/** The entries found are kept this long; the next opening of the search reloads them after it (ms). */
export const SEARCH_TTL = 60_000;

/** Lower case, «ё» as «е», trimmed: how the text and the query are compared. */
export function normalize(text: string): string {
  return text.toLowerCase().replaceAll('ё', 'е').trim();
}

/** 0 — the title starts with the token, 1 — a word of it does, 2 — it contains it, 3 — another field has it. */
function rank(entry: SearchEntry, token: string): number | null {
  const title = normalize(entry.title);
  if (title.startsWith(token)) {
    return 0;
  }
  if (title.split(/[\s\-–—.,()«»"]+/).some((word) => word.startsWith(token))) {
    return 1;
  }
  if (title.includes(token)) {
    return 2;
  }
  const rest = [entry.subtitle ?? '', ...(entry.keywords ?? [])].map(normalize);
  return rest.some((text) => text.includes(token)) ? 3 : null;
}

/**
 * Filters the entries by the query (every word of it must be found) and groups them: best matches first, then
 * by title. An empty query finds nothing; empty groups are left out.
 */
export function searchEntries(
  entries: readonly SearchEntry[],
  query: string,
  limit = SEARCH_GROUP_LIMIT,
): readonly SearchResultGroup[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }
  const found: { entry: SearchEntry; score: number }[] = [];
  for (const entry of entries) {
    let score = 0;
    let all = true;
    for (const token of tokens) {
      const r = rank(entry, token);
      if (r === null) {
        all = false;
        break;
      }
      score = Math.max(score, r);
    }
    if (all) {
      found.push({ entry, score });
    }
  }
  found.sort(
    (a, b) =>
      a.score - b.score ||
      a.entry.title.localeCompare(b.entry.title, undefined, { sensitivity: 'base' }),
  );
  return SEARCH_GROUPS.flatMap((group) => {
    const own = found.filter((f) => f.entry.group === group).map((f) => f.entry);
    return own.length === 0 ? [] : [{ group, entries: own.slice(0, limit), total: own.length }];
  });
}

/**
 * The teacher's global search (Ctrl K): the entries come from lists the API already serves and are filtered in the
 * browser (redesign spec §2, D6). The bar and the compact full-screen search share this state.
 */
@Injectable({ providedIn: 'root' })
export class GlobalSearch {
  private readonly injector = inject(Injector);
  private readonly factory = inject(SEARCH_SOURCES, { optional: true });
  private readonly entries = signal<readonly SearchEntry[]>([]);
  private readonly failedState = signal<readonly SearchGroup[]>([]);
  private readonly loadingState = signal(false);
  private loadedAt = 0;
  private pending: Promise<void> | null = null;

  readonly query = signal('');
  readonly loading = this.loadingState.asReadonly();
  /** The groups whose list could not be read: the results say so instead of showing nothing. */
  readonly failed = this.failedState.asReadonly();
  readonly results = computed(() => searchEntries(this.entries(), this.query()));

  /** Loads the entries on opening the search; fresh ones are not read again within {@link SEARCH_TTL}. */
  refresh(force = false): Promise<void> {
    if (this.pending) {
      return this.pending;
    }
    if (!force && this.loadedAt > 0 && Date.now() - this.loadedAt < SEARCH_TTL) {
      return Promise.resolve();
    }
    this.loadingState.set(true);
    this.pending = this.read().finally(() => {
      this.pending = null;
      this.loadingState.set(false);
    });
    return this.pending;
  }

  /** The next opening reads the lists again (after a student or an assignment was added…). */
  invalidate(): void {
    this.loadedAt = 0;
  }

  private async read(): Promise<void> {
    if (!this.factory) {
      return;
    }
    const sources = await runInInjectionContext(this.injector, this.factory);
    const failed: SearchGroup[] = [];
    const lists = await Promise.all(
      sources.map((source) =>
        firstValueFrom(
          source.load().pipe(
            catchError(() => {
              failed.push(source.group);
              return of<readonly SearchEntry[]>([]);
            }),
          ),
          { defaultValue: [] as readonly SearchEntry[] },
        ),
      ),
    );
    this.entries.set(lists.flat());
    this.failedState.set(failed);
    this.loadedAt = failed.length === 0 ? Date.now() : 0;
  }
}
