import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aBoard, aMyBoard } from '@testing/boards-fixtures';
import { BoardsApi } from './boards-api';

describe('BoardsApi', () => {
  let api: BoardsApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(BoardsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('lists, adds, changes and removes the boards of students and groups', () => {
    const seen: unknown[] = [];
    api.list().subscribe((boards) => seen.push(boards));
    backend.expectOne({ method: 'GET', url: '/api/teacher/boards' }).flush([aBoard()]);

    api
      .add({ type: 'STUDENT', id: 's-1', name: 'Мария' }, null, 'https://app.holst.so/b')
      .subscribe();
    const student = backend.expectOne({ method: 'POST', url: '/api/teacher/boards' });
    expect(student.request.body).toEqual({
      studentId: 's-1',
      groupId: null,
      title: null,
      url: 'https://app.holst.so/b',
    });
    student.flush(aBoard());

    api
      .add({ type: 'GROUP', id: 'g-1', name: 'ОГЭ' }, 'Общая', 'https://app.holst.so/g')
      .subscribe();
    const group = backend.expectOne({ method: 'POST', url: '/api/teacher/boards' });
    expect(group.request.body).toEqual({
      studentId: null,
      groupId: 'g-1',
      title: 'Общая',
      url: 'https://app.holst.so/g',
    });
    group.flush(aBoard({ ownerType: 'GROUP' }));

    api.change(aBoard({ version: 2 }), 'Геометрия', 'https://app.holst.so/2').subscribe();
    const change = backend.expectOne({ method: 'PUT', url: '/api/teacher/boards/board-1' });
    expect(change.request.body).toEqual({
      title: 'Геометрия',
      url: 'https://app.holst.so/2',
      version: 2,
    });
    change.flush(aBoard({ version: 3 }));

    api.remove('board-1').subscribe((result) => seen.push(result));
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/boards/board-1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    api.myBoards().subscribe((boards) => seen.push(boards));
    backend.expectOne({ method: 'GET', url: '/api/me/boards' }).flush([aMyBoard()]);

    expect(seen).toEqual([[aBoard()], undefined, [aMyBoard()]]);
  });
});
