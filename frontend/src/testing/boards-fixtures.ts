import { Board, MyBoard } from '@features/boards/data-access/boards.models';

/** A Holst board of a student, with overridable fields. */
export function aBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'board-1',
    ownerType: 'STUDENT',
    ownerId: 'student-1',
    ownerName: 'Мария',
    title: 'Алгебра',
    url: 'https://app.holst.so/board/1',
    holst: true,
    version: 0,
    ...overrides,
  };
}

/** A board in the student's list, with overridable fields. */
export function aMyBoard(overrides: Partial<MyBoard> = {}): MyBoard {
  return {
    id: 'board-1',
    ownerType: 'STUDENT',
    groupName: null,
    title: 'Алгебра',
    url: 'https://app.holst.so/board/1',
    holst: true,
    ...overrides,
  };
}
