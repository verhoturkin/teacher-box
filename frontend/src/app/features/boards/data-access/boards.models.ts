/** Mirrors the views of the boards module of the backend (ADR-0028). */

/** Our own Excalidraw board, or an external board by link. */
export type BoardKind = 'EXCALIDRAW' | 'LINK';

export type BoardMemberType = 'STUDENT' | 'GROUP';

/** Mirrors `MemberView`: a student or a group of a board; no name when they are gone. */
export interface BoardMember {
  readonly type: BoardMemberType;
  readonly id: string;
  readonly name: string | null;
}

/** Mirrors `BoardView`: a board with its students and groups. */
export interface Board {
  readonly id: string;
  readonly kind: BoardKind;
  readonly title: string;
  /** The link of an external board; `null` for an Excalidraw board. */
  readonly url: string | null;
  readonly members: readonly BoardMember[];
  readonly createdAt: string;
  /** The last change of the board or of its drawing. */
  readonly updatedAt: string;
  readonly version: number;
}

/** Mirrors `MyBoardView`: a board of the student, newest change first. */
export interface MyBoard {
  readonly id: string;
  readonly kind: BoardKind;
  readonly title: string;
  readonly url: string | null;
  /** The student's groups the board is bound to; empty when it is only the student's own. */
  readonly groupNames: readonly string[];
  readonly updatedAt: string;
}

/** What the teacher fills in for a board. */
export interface BoardInput {
  readonly title: string;
  readonly url: string | null;
  readonly studentIds: readonly string[];
  readonly groupIds: readonly string[];
}

/**
 * The stored drawing: Excalidraw's elements (deleted ones included) and the shared part of its appState.
 * Typed as plain JSON here: only `features/boards/editor` knows Excalidraw's types.
 */
export interface BoardScene {
  readonly sceneVersion: number;
  readonly elements: readonly unknown[];
  readonly appState: Readonly<Record<string, unknown>>;
}

/** Mirrors `BoardContent`: what the editor opens. */
export interface BoardContent extends BoardScene {
  readonly id: string;
  readonly kind: BoardKind;
  readonly title: string;
  /** The link of an external board (it has no drawing). */
  readonly url: string | null;
}

export type BoardBackupKind = 'DAILY' | 'MANUAL';

/** Mirrors `BackupView`: a copy of a board's drawing. */
export interface BoardBackup {
  readonly id: string;
  readonly kind: BoardBackupKind;
  readonly sceneVersion: number;
  readonly createdAt: string;
}

/** Which boards to list: of a student (with their groups' boards), of a group, or all. */
export interface BoardFilter {
  readonly studentId?: string | null;
  readonly groupId?: string | null;
}
