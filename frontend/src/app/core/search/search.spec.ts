import { TestBed } from '@angular/core/testing';
import { EMPTY, Observable, of, throwError } from 'rxjs';
import {
  GlobalSearch,
  SEARCH_SOURCES,
  SEARCH_TTL,
  SearchEntry,
  SearchGroup,
  SearchSource,
  normalize,
  searchEntries,
} from './search';

function entry(
  group: SearchGroup,
  id: string,
  title: string,
  extra: Partial<SearchEntry> = {},
): SearchEntry {
  return { id, group, title, link: ['/teacher', group, id], ...extra };
}

describe('searchEntries', () => {
  const entries = [
    entry('students', 's1', 'Анна Ёлкина', { keywords: ['anna@example.com'] }),
    entry('students', 's2', 'Борис'),
    entry('groups', 'g1', 'Группа Анны'),
    entry('assignments', 'a1', 'Present Perfect', { subtitle: 'Анна Ёлкина, Борис' }),
    entry('boards', 'b1', 'Доска Анны — Past Simple'),
    entry('textbooks', 't1', 'Headway', { subtitle: 'Intermediate' }),
  ];

  it('finds nothing for an empty query', () => {
    expect(searchEntries(entries, '  ')).toEqual([]);
  });

  it('treats «ё» as «е» and ignores case', () => {
    expect(normalize(' Ёлка ')).toBe('елка');
    const found = searchEntries(entries, 'ЕЛКИНА');
    expect(found.map((g) => g.group)).toEqual(['students', 'assignments']);
  });

  it('groups in the fixed order', () => {
    const found = searchEntries(entries, 'анн', 1);
    expect(found.map((g) => g.group)).toEqual(['students', 'groups', 'assignments', 'boards']);
    expect(found.every((g) => g.entries.length === 1)).toBe(true);
  });

  it('requires every word and looks in subtitle and keywords', () => {
    expect(searchEntries(entries, 'present борис').map((g) => g.group)).toEqual(['assignments']);
    expect(searchEntries(entries, 'present zzz')).toEqual([]);
    expect(searchEntries(entries, 'example.com')[0]?.entries[0]?.id).toBe('s1');
    expect(searchEntries(entries, 'intermediate')[0]?.group).toBe('textbooks');
  });

  it('ranks a title start before a word start, a substring and other fields', () => {
    const list = [
      entry('students', 'other', 'Борис', { keywords: ['маша'] }),
      entry('students', 'inside', 'Тамаша'),
      entry('students', 'word', 'Анна Маша'),
      entry('students', 'start', 'Машенька'),
    ];
    const ids = searchEntries(list, 'маш')[0]?.entries.map((e) => e.id);
    expect(ids).toEqual(['start', 'word', 'inside', 'other']);
  });

  it('keeps the total when the group is cut', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      entry('boards', `b${String(i)}`, `Доска ${String(i)}`),
    );
    const [group] = searchEntries(many, 'доска');
    expect(group?.entries).toHaveLength(5);
    expect(group?.total).toBe(8);
  });
});

describe('GlobalSearch', () => {
  function source(
    group: SearchGroup,
    load: () => Observable<readonly SearchEntry[]>,
  ): SearchSource {
    return { group, load };
  }

  function setup(sources?: () => readonly SearchSource[]): GlobalSearch {
    TestBed.configureTestingModule({
      providers: sources
        ? [{ provide: SEARCH_SOURCES, useValue: () => Promise.resolve(sources()) }]
        : [],
    });
    return TestBed.inject(GlobalSearch);
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the sources and answers the query', async () => {
    const search = setup(() => [
      source('students', () => of([entry('students', 's1', 'Анна')])),
      source('boards', () => of([entry('boards', 'b1', 'Анна и доска')])),
    ]);

    const loading = search.refresh();
    expect(search.loading()).toBe(true);
    await loading;
    search.query.set('анн');

    expect(search.loading()).toBe(false);
    expect(search.results().map((g) => g.group)).toEqual(['students', 'boards']);
    expect(search.failed()).toEqual([]);
  });

  it('reads once at a time and not again until the entries are stale', async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => of([entry('students', 's1', 'Анна')]));
    const search = setup(() => [source('students', load)]);

    await Promise.all([search.refresh(), search.refresh()]);
    await search.refresh();
    expect(load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(SEARCH_TTL + 1);
    await search.refresh();
    expect(load).toHaveBeenCalledTimes(2);

    search.invalidate();
    await search.refresh();
    expect(load).toHaveBeenCalledTimes(3);

    await search.refresh(true);
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('keeps the other groups when one list fails and reads again next time', async () => {
    const load = vi.fn(() => throwError(() => new Error('down')));
    const search = setup(() => [
      source('students', () => of([entry('students', 's1', 'Анна')])),
      source('boards', load),
    ]);

    await search.refresh();
    search.query.set('анна');
    expect(search.results().map((g) => g.group)).toEqual(['students']);
    expect(search.failed()).toEqual(['boards']);

    await search.refresh();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('survives a source that completes with nothing and an application without sources', async () => {
    const empty = setup(() => [source('students', () => EMPTY)]);
    await empty.refresh();
    empty.query.set('а');
    expect(empty.results()).toEqual([]);

    TestBed.resetTestingModule();
    const none = setup();
    await none.refresh();
    expect(none.results()).toEqual([]);
  });
});
