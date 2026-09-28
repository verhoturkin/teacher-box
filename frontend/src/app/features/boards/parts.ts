/**
 * Parts of the boards feature that other features embed: data access, the board cell and dialog,
 * the student's boards and «На доску». The feature has no pages of its own.
 */
export type { Board } from './data-access/boards.models';
export { BoardCell } from './manage/board-cell';
export { BoardsDialog } from './manage/boards-dialog';
export { OwnerBoardLinks } from './manage/owner-board-links';
export { OwnerBoards } from './manage/owner-boards';
export { MyBoardsCard } from './student/my-boards-card';
export { ToBoardDialog } from './to-board/to-board-dialog';
