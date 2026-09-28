import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { aBoard } from '@testing/boards-fixtures';
import { OwnerBoards } from './owner-boards';

describe('OwnerBoards', () => {
  let boards: OwnerBoards;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    boards = TestBed.runInInjectionContext(() => new OwnerBoards());
  });

  afterEach(() => {
    backend.verify();
  });

  it('keeps the boards of every owner and of the open one', () => {
    const algebra = aBoard();
    const geometry = aBoard({ id: 'board-2', title: 'Геометрия' });
    const group = aBoard({ id: 'board-3', ownerType: 'GROUP', ownerId: 'group-1' });
    boards.load();
    backend.expectOne('/api/teacher/boards').flush([algebra, geometry, group]);

    expect(boards.of('student-1')).toEqual([algebra, geometry]);
    expect(boards.of('nobody')).toEqual([]);
    expect(boards.ownerBoards()).toEqual([]);

    boards.open({ type: 'GROUP', id: 'group-1', name: 'ОГЭ' });
    expect(boards.visible()).toBe(true);
    expect(boards.ownerBoards()).toEqual([group]);

    const renamed = { ...group, title: 'Общая', version: 1 };
    boards.saved(renamed);
    const added = aBoard({ id: 'board-4', ownerType: 'GROUP', ownerId: 'group-1' });
    boards.saved(added);
    expect(boards.ownerBoards()).toEqual([renamed, added]);

    boards.removed(renamed);
    boards.saved(aBoard({ id: 'board-5', ownerId: 'student-2' }));
    expect(boards.ownerBoards()).toEqual([added]);
    expect(boards.of('student-2')).toHaveLength(1);
  });
});
