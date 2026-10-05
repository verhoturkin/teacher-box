import {
  Board,
  BoardBackup,
  BoardContent,
  MyBoard,
} from '@features/boards/data-access/boards.models';

/** An Excalidraw board of a student, with overridable fields. */
export function aBoard(overrides: Partial<Board> = {}): Board {
  return {
    id: 'board-1',
    kind: 'EXCALIDRAW',
    title: 'Алгебра',
    url: null,
    members: [{ type: 'STUDENT', id: 'student-1', name: 'Мария' }],
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-02T10:00:00Z',
    version: 0,
    ...overrides,
  };
}

/** An external board (Холст) of a group, with overridable fields. */
export function aLinkBoard(overrides: Partial<Board> = {}): Board {
  return aBoard({
    id: 'board-2',
    kind: 'LINK',
    title: 'Холст',
    url: 'https://app.holst.so/board/1',
    members: [{ type: 'GROUP', id: 'group-1', name: 'ОГЭ' }],
    ...overrides,
  });
}

/** A board in the student's list, with overridable fields. */
export function aMyBoard(overrides: Partial<MyBoard> = {}): MyBoard {
  return {
    id: 'board-1',
    kind: 'EXCALIDRAW',
    title: 'Алгебра',
    url: null,
    groupNames: [],
    updatedAt: '2026-10-02T10:00:00Z',
    ...overrides,
  };
}

/** What the editor opens: an Excalidraw board with one rectangle. */
export function aBoardContent(overrides: Partial<BoardContent> = {}): BoardContent {
  return {
    id: 'board-1',
    kind: 'EXCALIDRAW',
    title: 'Алгебра',
    url: null,
    sceneVersion: 3,
    elements: [{ id: 'r1', type: 'rectangle', version: 2, versionNonce: 7, isDeleted: false }],
    appState: { viewBackgroundColor: '#ffffff' },
    ...overrides,
  };
}

/** A copy of a board's drawing. */
export function aBoardBackup(overrides: Partial<BoardBackup> = {}): BoardBackup {
  return {
    id: 'backup-1',
    kind: 'MANUAL',
    sceneVersion: 3,
    createdAt: '2026-10-03T09:30:00Z',
    ...overrides,
  };
}
