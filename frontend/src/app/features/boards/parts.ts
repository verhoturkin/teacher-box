/**
 * Parts of the boards feature that other features embed: the boards of a lesson, the student's boards
 * and «На доску». Pages are in index.ts.
 */
export { BoardsApi } from './data-access/boards-api';
export type { Board } from './data-access/boards.models';
export { BoardsFeed, type BoardsFilter } from './teacher/boards-feed';
export { BoardLinks } from './manage/board-links';
export { MyBoardsFeed } from './student/my-boards-feed';
export { MyBoardButton } from './student/my-board-button';
export { MyBoardLinks } from './student/my-board-links';
export { ToBoardDialog, type Placed } from './to-board/to-board-dialog';
