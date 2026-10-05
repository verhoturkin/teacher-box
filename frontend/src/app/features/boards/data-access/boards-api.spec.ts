import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aBoard, aBoardBackup, aBoardContent, aMyBoard } from '@testing/boards-fixtures';
import { testProviders } from '@testing/setup';
import { BoardsApi } from './boards-api';

describe('BoardsApi', () => {
  let api: BoardsApi;
  let backend: HttpTestingController;
  const input = { title: 'Алгебра', url: null, studentIds: ['s-1'], groupIds: ['g-1'] };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: testProviders() });
    api = TestBed.inject(BoardsApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
  });

  it('lists all boards or those of a student or a group', () => {
    const seen: unknown[] = [];
    api.list().subscribe((boards) => seen.push(boards));
    backend.expectOne({ method: 'GET', url: '/api/teacher/boards' }).flush([aBoard()]);
    api.list({ studentId: 's-1' }).subscribe();
    backend.expectOne('/api/teacher/boards?studentId=s-1').flush([]);
    api.list({ groupId: 'g-1', studentId: null }).subscribe();
    backend.expectOne('/api/teacher/boards?groupId=g-1').flush([]);

    expect(seen).toEqual([[aBoard()]]);
  });

  it('creates, changes and removes boards', () => {
    api.create('EXCALIDRAW', input).subscribe();
    expect(backend.expectOne({ method: 'POST', url: '/api/teacher/boards' }).request.body).toEqual({
      kind: 'EXCALIDRAW',
      ...input,
    });
    api.change(aBoard({ version: 4 }), input).subscribe();
    expect(
      backend.expectOne({ method: 'PUT', url: '/api/teacher/boards/board-1' }).request.body,
    ).toEqual({ ...input, version: 4 });
    let removed = false;
    api.remove('board-1').subscribe(() => (removed = true));
    backend.expectOne({ method: 'DELETE', url: '/api/teacher/boards/board-1' }).flush(null);

    expect(removed).toBe(true);
  });

  it('gives the student their boards', () => {
    const seen: unknown[] = [];
    api.myBoards().subscribe((boards) => seen.push(boards));
    backend.expectOne({ method: 'GET', url: '/api/me/boards' }).flush([aMyBoard()]);

    expect(seen).toEqual([[aMyBoard()]]);
  });

  it('opens, saves and polls a drawing', () => {
    const seen: unknown[] = [];
    api.open('board-1').subscribe((content) => seen.push(content));
    backend.expectOne({ method: 'GET', url: '/api/boards/board-1' }).flush(aBoardContent());
    api
      .saveScene('board-1', [{ id: 'a' }], { gridSize: 20 }, 3)
      .subscribe((scene) => seen.push(scene));
    const save = backend.expectOne({ method: 'PUT', url: '/api/boards/board-1/scene' });
    expect(save.request.body).toEqual({
      elements: [{ id: 'a' }],
      appState: { gridSize: 20 },
      baseVersion: 3,
    });
    save.flush({ sceneVersion: 4, elements: [], appState: {} });
    api.changes('board-1', 4).subscribe((scene) => seen.push(scene));
    backend.expectOne('/api/boards/board-1/scene?since=4').flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    api.changes('board-1', 3).subscribe((scene) => seen.push(scene));
    backend
      .expectOne('/api/boards/board-1/scene?since=3')
      .flush({ sceneVersion: 4, elements: [], appState: {} });

    expect(seen).toEqual([
      aBoardContent(),
      { sceneVersion: 4, elements: [], appState: {} },
      null,
      { sceneVersion: 4, elements: [], appState: {} },
    ]);
  });

  it('uploads and downloads images', () => {
    const image = new Blob(['png'], { type: 'image/png' });
    api.uploadFile('board-1', 'f/1', image).subscribe();
    const upload = backend.expectOne({ method: 'PUT', url: '/api/boards/board-1/files/f%2F1' });
    expect(upload.request.headers.get('Content-Type')).toBe('image/png');
    expect(upload.request.body).toBe(image);
    upload.flush(null);
    const seen: Blob[] = [];
    api.file('board-1', 'f1').subscribe((blob) => seen.push(blob));
    backend.expectOne({ method: 'GET', url: '/api/boards/board-1/files/f1' }).flush(image);

    expect(seen).toHaveLength(1);
  });

  it('lists, makes, restores and deletes copies of a board', () => {
    const seen: unknown[] = [];
    api.backups('board-1').subscribe((backups) => seen.push(backups));
    backend.expectOne('/api/teacher/boards/board-1/backups').flush([aBoardBackup()]);
    api.createBackup('board-1').subscribe();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/boards/board-1/backups' })
      .flush(aBoardBackup());
    api.restoreBackup('board-1', 'backup-1').subscribe();
    backend
      .expectOne({ method: 'POST', url: '/api/teacher/boards/board-1/backups/backup-1/restore' })
      .flush(aBoardBackup({ id: 'backup-2' }));
    api.deleteBackup('board-1', 'backup-1').subscribe(() => seen.push('deleted'));
    backend
      .expectOne({ method: 'DELETE', url: '/api/teacher/boards/board-1/backups/backup-1' })
      .flush(null);

    expect(seen).toEqual([[aBoardBackup()], 'deleted']);
  });
});
