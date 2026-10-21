import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SearchEntry, SearchGroup, SearchSource } from '@core/search/search';
import { searchSources } from './search-sources';

describe('searchSources', () => {
  let http: HttpTestingController;
  let sources: readonly SearchSource[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    sources = await runInInjectionContext(TestBed.inject(Injector), searchSources);
  });

  async function entries(
    group: SearchGroup,
    url: string,
    body: object,
  ): Promise<readonly SearchEntry[]> {
    const source = sources.find((s) => s.group === group);
    if (!source) {
      throw new Error('no source');
    }
    const result = firstValueFrom(source.load());
    http.expectOne((req) => req.url === url).flush(body);
    return result;
  }

  it('has one source per group, in the order of the results', () => {
    expect(sources.map((s) => s.group)).toEqual([
      'students',
      'groups',
      'assignments',
      'boards',
      'textbooks',
    ]);
  });

  it('lists the students that are not deactivated, findable by login, e-mail and phone', async () => {
    const found = await entries('students', '/api/teacher/students', [
      {
        id: 's1',
        displayName: 'Анна',
        email: 'a@x.io',
        login: 'anna',
        phone: '+7 900',
        status: 'ACTIVE',
      },
      { id: 's2', displayName: 'Борис', email: null, login: null, phone: null, status: 'INVITED' },
      {
        id: 's3',
        displayName: 'Вера',
        email: null,
        login: null,
        phone: null,
        status: 'DEACTIVATED',
      },
    ]);

    expect(found).toEqual([
      {
        id: 's1',
        group: 'students',
        title: 'Анна',
        subtitle: 'a@x.io',
        link: ['/teacher/students', 's1'],
        keywords: ['anna', 'a@x.io', '+7 900'],
      },
      {
        id: 's2',
        group: 'students',
        title: 'Борис',
        subtitle: null,
        link: ['/teacher/students', 's2'],
        keywords: [],
      },
    ]);
  });

  it('lists the groups that are not archived with their members', async () => {
    const found = await entries('groups', '/api/teacher/groups', [
      {
        id: 'g1',
        name: 'ОГЭ',
        archivedAt: null,
        members: [{ displayName: 'Анна' }, { displayName: 'Борис' }],
      },
      { id: 'g2', name: 'Старая', archivedAt: '2026-01-01T00:00:00Z', members: [] },
      { id: 'g3', name: 'Пустая', archivedAt: null, members: [] },
    ]);

    expect(found.map((e) => [e.title, e.subtitle, e.link])).toEqual([
      ['ОГЭ', 'Анна, Борис', ['/teacher/groups', 'g1']],
      ['Пустая', null, ['/teacher/groups', 'g3']],
    ]);
  });

  it('lists the assignments with their students', async () => {
    const found = await entries('assignments', '/api/teacher/homework/assignments', [
      { id: 'a1', title: 'Past Simple', students: ['Анна', 'Борис'] },
      { id: 'a2', title: 'Essay', students: [] },
    ]);

    expect(found.map((e) => [e.title, e.subtitle, e.link])).toEqual([
      ['Past Simple', 'Анна, Борис', ['/teacher/homework', 'a1']],
      ['Essay', null, ['/teacher/homework', 'a2']],
    ]);
  });

  it('opens an Excalidraw board and leads an external one to the list of boards', async () => {
    const found = await entries('boards', '/api/teacher/boards', [
      {
        id: 'b1',
        kind: 'EXCALIDRAW',
        title: 'Парабола',
        members: [{ name: 'Анна' }, { name: null }],
      },
      { id: 'b2', kind: 'LINK', title: 'Miro', members: [] },
    ]);

    expect(found.map((e) => [e.title, e.subtitle, e.link, e.query])).toEqual([
      ['Парабола', 'Анна', ['/teacher/boards', 'b1'], undefined],
      ['Miro', null, ['/teacher/materials'], { tab: 'boards' }],
    ]);
  });

  it('lists the textbooks with their course and file name', async () => {
    const found = await entries('textbooks', '/api/teacher/textbooks', [
      { id: 't1', title: 'Headway', course: 'B1', filename: 'headway.pdf' },
    ]);

    expect(found).toEqual([
      {
        id: 't1',
        group: 'textbooks',
        title: 'Headway',
        subtitle: 'B1',
        link: ['/teacher/materials'],
        query: { tab: 'textbooks' },
        keywords: ['headway.pdf'],
      },
    ]);
  });
});
