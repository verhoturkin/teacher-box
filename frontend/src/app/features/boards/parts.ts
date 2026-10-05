/**
 * Parts of the boards feature that other features embed: the boards of a lesson, the student's boards
 * and «На доску». Pages are in index.ts.
 */
export type { Board } from './data-access/boards.models';
export { BoardLinks } from './manage/board-links';
export { MyBoardsCard } from './student/my-boards-card';
export { ToBoardDialog } from './to-board/to-board-dialog';
