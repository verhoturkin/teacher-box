import { Board, BoardBackupKind, BoardKind } from './data-access/boards.models';

export const BOARD_KIND_LABELS: Readonly<Record<BoardKind, string>> = {
  EXCALIDRAW: 'Доска Excalidraw',
  LINK: 'Внешняя доска',
};

export const BOARD_BACKUP_KIND_LABELS: Readonly<Record<BoardBackupKind, string>> = {
  DAILY: 'Ежедневная копия',
  MANUAL: 'Копия учителя',
};

/** The students and groups of a board in one line; those who are gone are skipped. */
export function boardMembersText(board: Board): string {
  const names = board.members.flatMap((member) =>
    member.name === null ? [] : [member.type === 'GROUP' ? `группа «${member.name}»` : member.name],
  );
  return names.length === 0 ? 'никому не открыта' : names.join(', ');
}

/** Where a board opens: the editor of the portal, or the external link. */
export function boardRoute(area: 'teacher' | 'cabinet', boardId: string): string {
  return `/${area}/boards/${boardId}`;
}
